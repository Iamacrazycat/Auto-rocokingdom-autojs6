var config = require("../config.js");

// ==================== 辅助函数 ====================

function getHsvBounds(hexColor, hueTol, satTol, valTol) {
    let value = hexColor.replace("#", "");
    let r = parseInt(value.substring(0, 2), 16);
    let g = parseInt(value.substring(2, 4), 16);
    let b = parseInt(value.substring(4, 6), 16);

    let Imgproc = org.opencv.imgproc.Imgproc;
    let Mat = org.opencv.core.Mat;
    let CvType = org.opencv.core.CvType;
    let bgrMat = new Mat(1, 1, CvType.CV_8UC3, new org.opencv.core.Scalar(b, g, r));

    let hsvMat = new Mat();
    Imgproc.cvtColor(bgrMat, hsvMat, Imgproc.COLOR_BGR2HSV);
    let hsv = hsvMat.get(0, 0); // [h, s, v]

    let bounds = [];
    let hMin = hsv[0] - hueTol;
    let hMax = hsv[0] + hueTol;
    let sMin = Math.max(0, hsv[1] - satTol);
    let vMin = Math.max(0, hsv[2] - valTol);

    if (hMin < 0) {
        bounds.push({
            lower: new org.opencv.core.Scalar(0, sMin, vMin),
            upper: new org.opencv.core.Scalar(hMax, 255, 255)
        });
        bounds.push({
            lower: new org.opencv.core.Scalar(180 + hMin, sMin, vMin),
            upper: new org.opencv.core.Scalar(179, 255, 255)
        });
    } else if (hMax > 179) {
        bounds.push({
            lower: new org.opencv.core.Scalar(hMin, sMin, vMin),
            upper: new org.opencv.core.Scalar(179, 255, 255)
        });
        bounds.push({
            lower: new org.opencv.core.Scalar(0, sMin, vMin),
            upper: new org.opencv.core.Scalar(hMax - 180, 255, 255)
        });
    } else {
        bounds.push({
            lower: new org.opencv.core.Scalar(hMin, sMin, vMin),
            upper: new org.opencv.core.Scalar(hMax, 255, 255)
        });
    }

    console.verbose(`[HSV Marker] hexColor:${hexColor} -> bgr:(${b},${g},${r}) -> hsv:(${hsv[0].toFixed(1)},${hsv[1].toFixed(1)},${hsv[2].toFixed(1)})`);

    bgrMat.release();
    hsvMat.release();
    return bounds;
}

function applyHsvBounds(hsvMat, boundsArr) {
    let Core = org.opencv.core.Core;
    let Mat = org.opencv.core.Mat;
    let finalMask = new Mat();
    
    for (let i = 0; i < boundsArr.length; i++) {
        let mask = new Mat();
        Core.inRange(hsvMat, boundsArr[i].lower, boundsArr[i].upper, mask);
        if (i === 0) {
            mask.copyTo(finalMask);
        } else {
            let combined = new Mat();
            Core.bitwise_or(finalMask, mask, combined);
            combined.copyTo(finalMask);
            combined.release();
        }
        mask.release();
    }
    return finalMask;
}

function calcMarkerScore(targetBgr, tplBgr, boundsArr, maxExtraPixels) {
    if (maxExtraPixels === undefined) maxExtraPixels = config.MARKER_MAX_EXTRA_PIXELS;
    let Imgproc = org.opencv.imgproc.Imgproc;
    let Core = org.opencv.core.Core;
    let Mat = org.opencv.core.Mat;

    let targetHsv = new Mat();
    let targetRgb3 = new Mat();
    if (targetBgr.channels() === 4) Imgproc.cvtColor(targetBgr, targetRgb3, Imgproc.COLOR_RGBA2RGB);
    else targetBgr.copyTo(targetRgb3);
    Imgproc.cvtColor(targetRgb3, targetHsv, Imgproc.COLOR_RGB2HSV);
    let targetMask = applyHsvBounds(targetHsv, boundsArr);

    let tplHsv = new Mat();
    let tplRgb3 = new Mat();
    if (tplBgr.channels() === 4) Imgproc.cvtColor(tplBgr, tplRgb3, Imgproc.COLOR_RGBA2RGB);
    else tplBgr.copyTo(tplRgb3);
    Imgproc.cvtColor(tplRgb3, tplHsv, Imgproc.COLOR_RGB2HSV);
    let tplMask = applyHsvBounds(tplHsv, boundsArr);

    let templatePixels = Core.countNonZero(tplMask);
    let targetPixels = Core.countNonZero(targetMask);
    let score = 0.0;

    if (templatePixels === 0) {
        score = targetPixels <= maxExtraPixels ? 1.0 : 0.0;
    } else {
        let intersection = new Mat();
        Core.bitwise_and(targetMask, tplMask, intersection);
        score = Core.countNonZero(intersection) / templatePixels;
        intersection.release();
    }

    targetRgb3.release();
    targetMask.release();
    targetHsv.release();
    tplRgb3.release();
    tplMask.release();
    tplHsv.release();

    return {
        score: score,
        targetPx: targetPixels,
        tplPx: templatePixels
    };
}

// ==================== 模板匹配 ====================

/**
 * 加载模板（同时保留 BGR 和 GRAY）
 */
function loadTemplate(name) {
    let dir = files.cwd() + "/" + config.TEMPLATE_DIR;
    let candidates = [name + ".png", name + ".jpg"];

    for (let i = 0; i < candidates.length; i++) {
        let path = dir + candidates[i];
        if (files.exists(path)) {
            let img = images.read(path);
            if (img) {
                let Imgproc = org.opencv.imgproc.Imgproc;
                let processed = new org.opencv.core.Mat();
                Imgproc.cvtColor(img.mat, processed, Imgproc.COLOR_BGR2GRAY);
                
                let bgrMat = new org.opencv.core.Mat();
                img.mat.copyTo(bgrMat);

                console.verbose("加载了模板: " + name);
                return {
                    name: name,
                    mat: processed,   // GRAY
                    bgrMat: bgrMat,   // BGR (用于HSV特征过滤)
                    width: img.width,
                    height: img.height,
                    original: img
                };
            }
        }
    }
    console.warn("[模板] 未找到模板文件: " + name);
    return null;
}

/**
 * 对模板执行多缩放比模板匹配，并可选使用 HSV Marker 过滤
 */
function matchTemplateWithScales(screenImg, tpl, threshold, useHsvMarker = false) {
    if (!tpl || !tpl.mat || !screenImg) return null;

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

    let bestMatch = null;

    try {
        let hsvBounds = null;
        let hsvOpt = null;
        if (useHsvMarker) {
            hsvOpt = typeof useHsvMarker === "object" ? useHsvMarker : {
                color: config.MARKER_COLOR,
                hueTol: config.MARKER_HUE_TOL,
                satTol: config.MARKER_SAT_TOL,
                valTol: config.MARKER_VAL_TOL,
                maxExtraPx: config.MARKER_MAX_EXTRA_PIXELS
            };
            hsvBounds = getHsvBounds(hsvOpt.color, hsvOpt.hueTol, hsvOpt.satTol, hsvOpt.valTol);
        }

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

            if (mmr.maxVal >= threshold) {
                let pt = mmr.maxLoc;
                let w = isScaled ? scaledMat.cols() : tpl.width;
                let h = isScaled ? scaledMat.rows() : tpl.height;
                
                let isMatched = true;
                let markerInfo = null;

                if (useHsvMarker) {
                    let Rect = org.opencv.core.Rect;
                    let targetCrop = new Mat(screenImg.mat, new Rect(pt.x, pt.y, w, h));
                    
                    let tplColorScaled = new Mat();
                    if (isScaled) {
                        let sz = new org.opencv.core.Size(w, h);
                        Imgproc.resize(tpl.bgrMat, tplColorScaled, sz, 0, 0, Imgproc.INTER_AREA || 3);
                    } else {
                        tpl.bgrMat.copyTo(tplColorScaled);
                    }

                    markerInfo = calcMarkerScore(targetCrop, tplColorScaled, hsvBounds, hsvOpt.maxExtraPx);
                    
                    targetCrop.release();
                    tplColorScaled.release();

                    if (markerInfo.score < config.MARKER_SCORE_THRESHOLD) {
                        // 标记为低特征分数，但不直接拦截，交由上层逻辑判断
                        // isMatched = false;
                    }
                }

                if (isMatched) {
                    if (!bestMatch || mmr.maxVal > bestMatch.score) {
                        bestMatch = {
                            x: pt.x + Math.floor(w / 2),
                            y: pt.y + Math.floor(h / 2),
                            score: mmr.maxVal,
                            markerScore: markerInfo ? markerInfo.score : 1.0,
                            targetPx: markerInfo ? markerInfo.targetPx : 0,
                            tplPx: markerInfo ? markerInfo.tplPx : 0,
                            matched: true
                        };
                        console.verbose(`[模板匹配] ${tpl.name} x${scale.toFixed(2)} 得分:${mmr.maxVal.toFixed(3)}` + 
                            (markerInfo ? ` marker:${markerInfo.score.toFixed(3)} px:${markerInfo.targetPx}/${markerInfo.tplPx}` : ""));
                    }
                }
            }
            if (isScaled) scaledMat.release();
        }
    } catch (e) {
        console.error("[模板匹配] " + tpl.name + " 出错: " + e.message);
    }
    screenGray.release();
    return bestMatch;
}

// ==================== 导出 ====================

module.exports = {
    loadTemplate: loadTemplate,
    matchTemplateWithScales: matchTemplateWithScales
};
