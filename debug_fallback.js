console.show();
console.log("=== 模板匹配降级与 OCR 诊断工具 ===");

let targetPath = files.cwd() + "/debug_capture_first.png";
let targetImg = images.read(targetPath);
if (!targetImg) {
    console.error("未找到目标大图！");
    exit();
}

let templatePath = null;
let dir = files.cwd() + "/templates/";
let list = files.listDir(dir);
for (let item of list) {
    if (item.endsWith(".png") || item.endsWith(".jpg")) {
        templatePath = dir + item;
        break;
    }
}

let tplImg = images.read(templatePath);
console.log(`[图像测试] 大图:${targetImg.width}x${targetImg.height}, 小图:${tplImg.width}x${tplImg.height}`);

// 测试 1: 降低阈值的标准模板匹配
try {
    console.log("\n--- 测试 images.matchTemplate (放宽阈值至 0.6) ---");
    let result = images.matchTemplate(targetImg, tplImg, {
        threshold: 0.6,
        max: 3
    });
    console.log("匹配点集合:", result.matches);
    if (result.matches.length > 0) {
        console.log("-> 甚至用简单的 matchTemplate 也能找着！最佳得分:", result.matches[0].similarity);
    } else {
        console.log("-> 仍然是 0 个结果，说明像素因为半透明/粒子动画等导致了巨大偏差。");
    }
} catch (e) {
    console.error("模板匹配报错: ", e);
}

// 测试 2: 直接使用 Paddle OCR 检测全屏字块
try {
    console.log("\n--- 测试内置 Paddle OCR 识别 ---");
    // AutoJs6 / AutoJS Pro 的通用 OCR 接口
    let start = Date.now();
    let ocrResult = paddle.ocr(targetImg);
    let end = Date.now();
    console.log(`OCR 扫描耗时: ${end - start} ms`);
    
    if (ocrResult && ocrResult.length > 0) {
        for (let i = 0; i < ocrResult.length; i++) {
            let res = ocrResult[i];
            console.log(`文本:「${res.text}」，准确率: ${res.confidence.toFixed(2)}，坐标: (${res.bounds.left}, ${res.bounds.top})`);
        }
    } else {
        console.log("OCR 未扫描到任何文字。可能未加载模型。");
    }
} catch (e) {
    console.error("OCR 执行报错: ", e);
}

targetImg.recycle();
tplImg.recycle();
console.log("======= 诊断完毕 =======");
