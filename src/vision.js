var config = require("../config.js");

// ==================== OCR 识别 ====================

/**
 * OCR 文字提取（带 CLAHE 对比度增强预处理）
 * 解决浅色背景下灰色文字识别率低的问题
 */
function detectOcrText(screenImg) {
    let results = [];
    try {
        let processedImg = enhanceContrast(screenImg);
        let targetImg = processedImg || screenImg;

        let ocrResults = ocr.detect(targetImg);
        if (ocrResults && ocrResults.length > 0) {
            for (let i = 0; i < ocrResults.length; i++) {
                results.push({
                    text: ocrResults[i].text,
                    bounds: ocrResults[i].bounds
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
 */
function enhanceContrast(screenImg) {
    try {
        let Imgproc = org.opencv.imgproc.Imgproc;
        let Mat = org.opencv.core.Mat;

        let srcMat = screenImg.mat;
        let gray = new Mat();
        Imgproc.cvtColor(srcMat, gray, Imgproc.COLOR_BGR2GRAY);

        let clahe = Imgproc.createCLAHE(3.0, new org.opencv.core.Size(8, 8));
        let enhanced = new Mat();
        clahe.apply(gray, enhanced);

        let bgr = new Mat();
        Imgproc.cvtColor(enhanced, bgr, Imgproc.COLOR_GRAY2BGR);

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

    let clickX = Math.floor((textBounds.left + textBounds.right) / 2);
    let yOffset = screenImg.height * (59.0 / 887.0);
    let clickY = Math.floor(textBounds.top - yOffset);

    return { x: clickX, y: Math.max(0, clickY), score: 1.0 };
}

// ==================== 模板匹配（仅 escape_yes） ====================

/**
 * 加载 escape_yes 模板（灰度预处理）
 */
function loadEscapeYesTemplate() {
    let dir = files.cwd() + "/" + config.TEMPLATE_DIR;
    let candidates = ["escape_yes.png", "escape_yes.jpg"];

    for (let i = 0; i < candidates.length; i++) {
        let path = dir + candidates[i];
        if (files.exists(path)) {
            let img = images.read(path);
            if (img) {
                let Imgproc = org.opencv.imgproc.Imgproc;
                let processed = new org.opencv.core.Mat();
                Imgproc.cvtColor(img.mat, processed, Imgproc.COLOR_BGR2GRAY);
                console.verbose("加载了 escape_yes 模板 (GRAY)");
                return {
                    name: "escape_yes",
                    mat: processed,
                    width: img.width,
                    height: img.height,
                    original: img
                };
            }
        }
    }
    console.warn("[模板] 未找到 escape_yes 模板文件");
    return null;
}

/**
 * 对 escape_yes 执行多缩放比灰度模板匹配
 */
function matchEscapeYes(screenImg, tpl) {
    if (!tpl || !tpl.mat) return null;

    let Imgproc = org.opencv.imgproc.Imgproc;
    let Core = org.opencv.core.Core;
    let Mat = org.opencv.core.Mat;

    let scaleW = screenImg.width / config.REF_WIDTH;
    let scaleH = screenImg.height / config.REF_HEIGHT;
    let scales = [scaleW, scaleH, 1.0];

    let uniqueScales = [];
    for (let s of scales) {
        if (!uniqueScales.some(e => Math.abs(e - s) < 0.05)) {
            uniqueScales.push(s);
        }
    }

    let screenGray = new Mat();
    Imgproc.cvtColor(screenImg.mat, screenGray, Imgproc.COLOR_BGR2GRAY);

    try {
        for (let scale of uniqueScales) {
            let scaledMat;
            let isScaled = Math.abs(scale - 1.0) > 0.05;

            if (isScaled) {
                scaledMat = new Mat();
                let sz = new org.opencv.core.Size(
                    Math.max(1, Math.floor(tpl.width * scale)),
                    Math.max(1, Math.floor(tpl.height * scale))
                );
                Imgproc.resize(tpl.mat, scaledMat, sz, 0, 0, Imgproc.INTER_AREA || 3);
            } else {
                scaledMat = tpl.mat;
            }

            let result = new Mat();
            Imgproc.matchTemplate(screenGray, scaledMat, result, Imgproc.TM_CCOEFF_NORMED);
            let mmr = Core.minMaxLoc(result);
            result.release();

            if (mmr.maxVal >= config.ESCAPE_YES_THRESHOLD) {
                let pt = mmr.maxLoc;
                let w = isScaled ? scaledMat.cols() : tpl.width;
                let h = isScaled ? scaledMat.rows() : tpl.height;

                console.verbose("[模板匹配] escape_yes 缩放(x" + scale.toFixed(2) + ") 得分:" + mmr.maxVal.toFixed(3));
                if (isScaled) scaledMat.release();
                screenGray.release();
                return {
                    x: pt.x + Math.floor(w / 2),
                    y: pt.y + Math.floor(h / 2),
                    score: mmr.maxVal
                };
            }
            if (isScaled) scaledMat.release();
        }
    } catch (e) {
        console.error("[模板匹配] escape_yes 出错: " + e.message);
    }
    screenGray.release();
    return null;
}

// ==================== HSV 紫底检测 ====================

/**
 * 检测屏幕紫色区域占比
 */
function detectPurpleRatio(screenImg) {
    let mat = screenImg.mat;
    if (!mat) return 0;

    let Imgproc = org.opencv.imgproc.Imgproc;
    let Core = org.opencv.core.Core;

    let hsv = new org.opencv.core.Mat();
    Imgproc.cvtColor(mat, hsv, Imgproc.COLOR_BGR2HSV);

    let lower = new org.opencv.core.Scalar(config.PURPLE_LOWER_HSV[0], config.PURPLE_LOWER_HSV[1], config.PURPLE_LOWER_HSV[2]);
    let upper = new org.opencv.core.Scalar(config.PURPLE_UPPER_HSV[0], config.PURPLE_UPPER_HSV[1], config.PURPLE_UPPER_HSV[2]);
    let mask = new org.opencv.core.Mat();

    Core.inRange(hsv, lower, upper, mask);

    let nonZero = Core.countNonZero(mask);
    let total = mask.rows() * mask.cols();

    mask.release();
    hsv.release();

    return total === 0 ? 0 : nonZero / total;
}

// ==================== 导出 ====================

module.exports = {
    detectOcrText: detectOcrText,
    calculateIconClick: calculateIconClick,
    loadEscapeYesTemplate: loadEscapeYesTemplate,
    matchEscapeYes: matchEscapeYes,
    detectPurpleRatio: detectPurpleRatio
};
