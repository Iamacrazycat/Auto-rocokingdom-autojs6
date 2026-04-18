var config = require("../config.js");

/**
 * 加载所有模板图像
 * @returns {Object} 包含 name 和 image 对象的字典
 */
function loadTemplates() {
    let templates = {};
    let dir = files.cwd() + "/" + config.TEMPLATE_DIR;
    let Imgproc = org.opencv.imgproc.Imgproc;
    let Mat = org.opencv.core.Mat;
    
    if (!files.exists(dir)) {
        files.createWithDirs(dir);
        return templates;
    }

    let list = files.listDir(dir);
    list.forEach(item => {
        if (item.endsWith(".png") || item.endsWith(".jpg")) {
            let img = images.read(dir + item);
            if (img) {
                let name = item.split(".")[0];
                try {
                    let mat = img.mat;
                    let processed = new Mat();
                    // 1. 始终转成灰度图
                    Imgproc.cvtColor(mat, processed, Imgproc.COLOR_BGR2GRAY);
                    
                    // 2. 如果不是 escape_yes，则提前抽出 Canny 边缘 （和 Python 脚本 100% 同步！）
                    let isYes = name.indexOf("yes") !== -1;
                    if (!isYes) {
                        Imgproc.Canny(processed, processed, 100, 200);
                    }

                    templates[name] = {
                        name: name,
                        mat: processed,      // 此时存的是一个已经提炼完毕的特征 Mat！
                        width: img.width,
                        height: img.height,
                        original: img        // 保持引用防止被 JVM 垃圾回收
                    };
                    console.verbose(`加载了匹配模板[${isYes ? 'GRAY' : 'CANNY'}]: ${name}`);
                } catch(e) {
                    console.error("加载特征失败: " + name + " " + e);
                }
            }
        }
    });

    return templates;
}

/**
 * 包装自适应多档缩放的模板匹配逻辑
 * @param {Image} screenImg 当前屏幕截图
 * @param {Object} templateObj 模板对象 {image}
 * @returns {Object|null} 如果匹配成功，返回包含 {x, y, score} 的对象；否则返回 null
 */
function matchFeature(screenImg, templateObj, customThreshold) {
    if (!templateObj || !templateObj.mat) {
        console.warn("未传入有效的特征 Mat 模板");
        return null;
    }

    let searchThreshold = customThreshold !== undefined ? customThreshold : config.MATCH_THRESHOLD;
    let scaleW = screenImg.width / config.REF_WIDTH;
    let scaleH = screenImg.height / 1440;
    
    let scalesToTry = [scaleW, scaleH, 1.0];
    let uniqueScales = [];
    for (let s of scalesToTry) {
        if (!uniqueScales.some(existing => Math.abs(existing - s) < 0.05)) {
            uniqueScales.push(s);
        }
    }

    let Imgproc = org.opencv.imgproc.Imgproc;
    let Core = org.opencv.core.Core;
    let Mat = org.opencv.core.Mat;
    let INTER_AREA = Imgproc.INTER_AREA || 3;  // 常量后备

    try {
        let isYes = templateObj.name.indexOf("yes") !== -1;
        
        // 实时对屏幕大图进行相应的特征提取
        let screenMat = screenImg.mat;
        let screenProcessed = new Mat();
        Imgproc.cvtColor(screenMat, screenProcessed, Imgproc.COLOR_BGR2GRAY);
        if (!isYes) {
            Imgproc.Canny(screenProcessed, screenProcessed, 100, 200);
        }

        for (let scale of uniqueScales) {
            let tplProcessed = templateObj.mat; // 读取缓存中提取好的特征 Mat
            let scaledTplMat;
            let isScaled = Math.abs(scale - 1.0) > 0.05;

            try {
                if (isScaled) {
                    scaledTplMat = new Mat();
                    let newW = Math.max(1, Math.floor(templateObj.width * scale));
                    let newH = Math.max(1, Math.floor(templateObj.height * scale));
                    let sz = new org.opencv.core.Size(newW, newH);
                    // 重点：使用 INTER_AREA 压缩特征图线条！这是无缝平滑锯齿的核心！
                    Imgproc.resize(tplProcessed, scaledTplMat, sz, 0, 0, INTER_AREA);
                } else {
                    scaledTplMat = tplProcessed;
                }

                let resultMat = new Mat();
                Imgproc.matchTemplate(screenProcessed, scaledTplMat, resultMat, Imgproc.TM_CCOEFF_NORMED);
                
                let mmr = Core.minMaxLoc(resultMat);
                let sim = mmr.maxVal;
                
                resultMat.release();

                if (sim >= searchThreshold) {
                    let pt = mmr.maxLoc;
                    let curW = isScaled ? scaledTplMat.cols() : templateObj.width;
                    let curH = isScaled ? scaledTplMat.rows() : templateObj.height;

                    let clickX = pt.x + Math.floor(curW / 2);
                    let clickY = pt.y + Math.floor(curH / 2);

                    console.verbose(`[Mat 矩阵匹配成功] 模板: ${templateObj.name}, 缩放比(x${scale.toFixed(2)}) 匹配得分:${sim.toFixed(3)}`);
                    screenProcessed.release();
                    if (isScaled) scaledTplMat.release();
                    
                    return { x: clickX, y: clickY, score: sim };
                }
            } catch (e) {
                console.error("单次匹配出错: " + e.message);
            } finally {
                if (isScaled && scaledTplMat) {
                    scaledTplMat.release();
                }
            }
        } // 结束 for
        screenProcessed.release();
    } catch (e) {
        console.error("整体匹配管道崩溃: " + e.message);
    }
    
    return null;
}

/**
 * 基于 HSV 判断紫底的占比，用作智能模式的判断
 * @param {Image} screenImg 当前屏幕截图
 * @returns {Number} 0.0 到 1.0 的比例 
 */
function detectPurpleRatio(screenImg) {
    let mat = screenImg.mat;
    if (!mat) return 0;

    let hsv = new org.opencv.core.Mat();
    org.opencv.imgproc.Imgproc.cvtColor(mat, hsv, org.opencv.imgproc.Imgproc.COLOR_BGR2HSV);
    
    // OpenCV inRange 使用原生的 Java 封装，规避报错
    let lower = new org.opencv.core.Scalar(config.PURPLE_LOWER_HSV[0], config.PURPLE_LOWER_HSV[1], config.PURPLE_LOWER_HSV[2]);
    let upper = new org.opencv.core.Scalar(config.PURPLE_UPPER_HSV[0], config.PURPLE_UPPER_HSV[1], config.PURPLE_UPPER_HSV[2]);
    let mask = new org.opencv.core.Mat();
    
    org.opencv.core.Core.inRange(hsv, lower, upper, mask);
    
    let nonZeroCount = org.opencv.core.Core.countNonZero(mask);
    let totalCount = mask.rows() * mask.cols();
    
    // 记得主动释放内存，避免 OOM (Scalar 为对象数据类型无需 release，只有 Mat 需要)
    mask.release();
    hsv.release();
    
    if (totalCount === 0) return 0;
    return nonZeroCount / totalCount;
}

module.exports = {
    loadTemplates: loadTemplates,
    matchFeature: matchFeature,
    detectPurpleRatio: detectPurpleRatio
};
