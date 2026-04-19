var config = require("../config.js");
var vision = require("./vision.js");
var inputHandler = require("./input.js");

function AutoRocoBot(mode) {
    this.mode = mode;            // "1" 聚能 | "2" 逃跑 | "3" 智能
    this.escapeYesTpl = null;    // escape_yes 模板（唯一保留的模板匹配）
    this.inBattleState = false;
    this.hitStreak = 0;
    this.missStreak = 0;
    this.lastTriggerTime = 0;
}

AutoRocoBot.prototype.init = function () {
    console.log("正在初始化 Bot...");

    if (!requestScreenCapture(true)) {
        toastLog("请求截图失败，停止运行");
        exit();
    }

    // 只加载 escape_yes 模板（用于确认弹窗，该模板无杂色，模板匹配可靠）
    this.escapeYesTpl = vision.loadEscapeYesTemplate();
    console.log("初始化完成！当前运行模式:", this.mode);
    sleep(1000);
};

AutoRocoBot.prototype.run = function () {
    console.log("-> 启动监控循环...");

    while (true) {
        let screenImg = captureScreen();
        if (!screenImg) {
            sleep(config.POLL_INTERVAL_MS);
            continue;
        }

        // ---- OCR 识别战斗状态 ----
        let ocrResults = vision.detectOcrText(screenImg);
        let combatKeywords = ["更换", "逃跑", "技能", "捕捉", "背包", "聚能"];
        let matchedKeywords = 0;
        let matchedNames = [];
        let ocrMap = {};

        if (ocrResults && ocrResults.length > 0) {
            let allTexts = ocrResults.map(r => r.text);
            console.verbose(`[OCR] 共${ocrResults.length}条: ${allTexts.join(" | ")}`);

            ocrResults.forEach(res => {
                combatKeywords.forEach(kw => {
                    if (res.text.indexOf(kw) !== -1 && !ocrMap[kw]) {
                        matchedKeywords++;
                        matchedNames.push(kw);
                        ocrMap[kw] = res.bounds;
                    }
                });
            });

            if (matchedKeywords > 0) {
                console.verbose(`[OCR 命中] ${matchedNames.join(", ")} (${matchedKeywords}/${combatKeywords.length})`);
            }
        }

        // ---- 状态机 ----
        let detected = (matchedKeywords >= config.OCR_COMBAT_THRESHOLD);

        if (detected) {
            this.hitStreak++;
            this.missStreak = 0;
        } else {
            this.hitStreak = 0;
            this.missStreak++;
        }

        if (!this.inBattleState) {
            this.inBattleState = (this.hitStreak >= config.REQUIRED_HITS);
        } else {
            if (this.missStreak >= config.RELEASE_MISSES) {
                this.inBattleState = false;
            }
        }

        // ---- 执行动作 ----
        let now = new Date().getTime();
        if (this.inBattleState && (now - this.lastTriggerTime >= config.TRIGGER_COOLDOWN_MS)) {
            this.decideAndAct(screenImg, ocrMap);
            this.lastTriggerTime = now;
        } else {
            console.verbose(`[轮询] 战斗:${this.inBattleState} | OCR命中:${matchedKeywords} | 连续命中:${this.hitStreak} | 连续丢失:${this.missStreak}`);
        }

        screenImg.recycle();
        sleep(config.POLL_INTERVAL_MS);
    }
};

AutoRocoBot.prototype.decideAndAct = function (screenImg, ocrMap) {
    var currentAction = this.mode;

    // 智能模式：通过紫底比例判断聚能还是逃跑
    if (this.mode === "3") {
        let ratio = vision.detectPurpleRatio(screenImg);
        console.log(`[Smart] 紫底比例: ${ratio.toFixed(4)} (阈值: ${config.SMART_MODE_PURPLE_RATIO_THRESHOLD})`);

        if (ratio >= config.SMART_MODE_PURPLE_RATIO_THRESHOLD) {
            console.log("-> 紫底匹配 -> 执行[聚能]");
            currentAction = "1";
        } else {
            console.log("-> 非紫底 -> 执行[逃跑]");
            currentAction = "2";
        }
    }

    if (currentAction === "1") {
        // 聚能：通过 OCR 定位「聚能」或「技能」文字上方的图标
        let bounds = ocrMap["聚能"] || ocrMap["技能"];
        if (bounds) {
            let loc = vision.calculateIconClick(screenImg, bounds);
            if (loc) inputHandler.clickSkillX(loc);
        } else {
            console.warn("[聚能] OCR 未找到 '聚能/技能' 文字");
        }

    } else if (currentAction === "2") {
        // 逃跑：通过 OCR 定位「逃跑」文字上方的图标
        let bounds = ocrMap["逃跑"];
        if (bounds) {
            let loc = vision.calculateIconClick(screenImg, bounds);
            if (loc) {
                inputHandler.clickEscape(loc);
                sleep(1000);

                // 确认弹窗：使用模板匹配找「是」按钮
                let confirmScreen = captureScreen();
                if (confirmScreen) {
                    let yesLoc = vision.matchEscapeYes(confirmScreen, this.escapeYesTpl);
                    if (yesLoc) {
                        inputHandler.clickConfirmYes(yesLoc);
                        console.log("[逃跑] 成功，重置战斗状态");
                        this.inBattleState = false;
                        this.hitStreak = 0;
                        this.missStreak = 0;
                    } else {
                        console.warn("[逃跑] 未找到确认'是'按钮");
                    }
                    confirmScreen.recycle();
                }
                sleep(3000); // 等待逃跑动画过渡
            }
        } else {
            console.warn("[逃跑] OCR 未找到 '逃跑' 文字，跳过本轮");
        }
    }
};

module.exports = AutoRocoBot;
