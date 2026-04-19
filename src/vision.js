var config = require("../config.js");

/**
 * 加载所有模板图像
 * @returns {Object} 包含 name 和预处理 Mat 的字典
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
                    Imgproc.cvtColor(mat, processed, Imgproc.COLOR_BGR2GRAY);
                    
                    let isYes = name.indexOf("yes") !== -1;
                    if (!isYes) {
                        Imgproc.Canny(processed, processed, 100, 200);
                    }

                    templates[name] = {
                        name: name,
                        mat: processed,
                        width: img.width,
                        height: img.height,
                        original: img
                    };
                    console.verbose("加载了匹配模板[" + (isYes ? "GRAY" : "CANNY") + "]: " + name);
                } catch(e) {
                    console.error("加载特征失败: " + name + " " + e);
                }
            }
        }
    });

    return templates;
}

/**
 * 多档缩放模板匹配
 */
function matchFeature(screenImg, templateObj, customThreshold) {
    if (!templateObj || !templateObj.mat) {
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
    let INTER_AREA = Imgproc.INTER_AREA || 3;

    try {
        let isYes = templateObj.name.indexOf("yes") !== -1;
        
        let screenMat = screenImg.mat;
        let screenProcessed = new Mat();
        Imgproc.cvtColor(screenMat, screenProcessed, Imgproc.COLOR_BGR2GRAY);
        if (!isYes) {
            Imgproc.Canny(screenProcessed, screenProcessed, 100, 200);
        }

        for (let scale of uniqueScales) {
            let tplProcessed = templateObj.mat;
            let scaledTplMat;
            let isScaled = Math.abs(scale - 1.0) > 0.05;

            try {
                if (isScaled) {
                    scaledTplMat = new Mat();
                    let newW = Math.max(1, Math.floor(templateObj.width * scale));
                    let newH = Math.max(1, Math.floor(templateObj.height * scale));
                    let sz = new org.opencv.core.Size(newW, newH);
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

                    console.verbose("[Mat 矩阵匹配成功] 模板: " + templateObj.name + ", 缩放比(x" + scale.toFixed(2) + ") 匹配得分:" + sim.toFixed(3));
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
        }
        screenProcessed.release();
    } catch (e) {
        console.error("整体匹配管道崩溃: " + e.message);
    }
    
    return null;
}

/**
 * OCR 文字提取（带 CLAHE 对比度增强预处理）
 * 解决浅色背景下灰色文字识别率低的问题
 */
function detectOcrText(screenImg) {
    let results = [];
    try {
        // 对截图进行 CLAHE 对比度增强，使灰色文字在浅色背景上更清晰
        let processedImg = enhanceContrast(screenImg);
        let targetImg = processedImg || screenImg; // 增强失败则用原图

        let ocrResults = ocr.detect(targetImg);
        if (ocrResults && ocrResults.length > 0) {
            for (let i = 0; i < ocrResults.length; i++) {
                let res = ocrResults[i];
                results.push({
                    text: res.text,
                    bounds: res.bounds
                });
            }
        }

        if (processedImg) processedImg.recycle();
    } catch (e) {
        console.error("[OCR] 识别出错: " + e.message);
    }
    return results;
}

/**
 * CLAHE 自适应直方图均衡化：增强局部对比度
 * 让浅色背景上的灰色文字变得黑白分明，大幅提升 OCR 识别率
 * @returns {Image|null} 增强后的图像，失败返回 null
 */
function enhanceContrast(screenImg) {
    try {
        let Imgproc = org.opencv.imgproc.Imgproc;
        let Mat = org.opencv.core.Mat;

        let srcMat = screenImg.mat;
        let gray = new Mat();
        Imgproc.cvtColor(srcMat, gray, Imgproc.COLOR_BGR2GRAY);

        // CLAHE: clipLimit 控制对比度放大倍数，tileGridSize 控制局部区域大小
        let clahe = Imgproc.createCLAHE(3.0, new org.opencv.core.Size(8, 8));
        let enhanced = new Mat();
        clahe.apply(gray, enhanced);

        // 转回 BGR（OCR 引擎可能需要彩色输入）
        let bgr = new Mat();
        Imgproc.cvtColor(enhanced, bgr, Imgproc.COLOR_GRAY2BGR);

        // Mat -> 临时文件 -> AutoJS Image（规避 ImageWrapper 构造兼容问题）
        let tempPath = files.cwd() + "/_ocr_enhanced.jpg";
        org.opencv.imgcodecs.Imgcodecs.imwrite(tempPath, bgr);
        let resultImg = images.read(tempPath);

        gray.release();
        enhanced.release();
        bgr.release();

        return resultImg;
    } catch (e) {
        console.warn("[CLAHE] 对比度增强失败，使用原图: " + e.message);
        return null;
    }
}

/**
 * 根据 OCR 文字边界框，计算其上方图标的点击坐标
 */
function calculateIconClick(screenImg, textBounds) {
    if (!textBounds) return null;
    let left = textBounds.left;
    let right = textBounds.right;
    let top = textBounds.top;
    
    let clickX = Math.floor((left + right) / 2);
    let yOffset = screenImg.height * (59.0 / 887.0);
    let clickY = Math.floor(top - yOffset);
    
    return { x: clickX, y: Math.max(0, clickY), score: 1.0 };
}

/**
 * HSV 紫底检测
 */
function detectPurpleRatio(screenImg) {
    let mat = screenImg.mat;
    if (!mat) return 0;

    let hsv = new org.opencv.core.Mat();
    org.opencv.imgproc.Imgproc.cvtColor(mat, hsv, org.opencv.imgproc.Imgproc.COLOR_BGR2HSV);
    
    let lower = new org.opencv.core.Scalar(config.PURPLE_LOWER_HSV[0], config.PURPLE_LOWER_HSV[1], config.PURPLE_LOWER_HSV[2]);
    let upper = new org.opencv.core.Scalar(config.PURPLE_UPPER_HSV[0], config.PURPLE_UPPER_HSV[1], config.PURPLE_UPPER_HSV[2]);
    let mask = new org.opencv.core.Mat();
    
    org.opencv.core.Core.inRange(hsv, lower, upper, mask);
    
    let nonZeroCount = org.opencv.core.Core.countNonZero(mask);
    let totalCount = mask.rows() * mask.cols();
    
    mask.release();
    hsv.release();
    
    if (totalCount === 0) return 0;
    return nonZeroCount / totalCount;
}

module.exports = {
    loadTemplates: loadTemplates,
    matchFeature: matchFeature,
    detectOcrText: detectOcrText,
    calculateIconClick: calculateIconClick,
    detectPurpleRatio: detectPurpleRatio
};
