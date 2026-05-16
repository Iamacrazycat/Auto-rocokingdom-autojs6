var config = require("../config.js");
var vision = require("./vision.js");
var inputHandler = require("./input.js");

function AutoRocoBot(mode) {
    this.mode = mode; // Keep mode if it's used somewhere else, though we use state machine now
    this.tpls = {};
    
    // 状态机变量
    this.lastNonOtherState = "非战斗"; // 初始假设为非战斗
    this.effectiveBattleState = null;   // 锁定当前战斗的有效状态（"有效战斗" 或 "无效战斗"）

    // 坐标缓存（节省算力）
    this.cachedSkillXLoc = null;
    this.cachedEscapeBtnLoc = null;

    // 运行控制标志
    this.isPaused = false;
}

AutoRocoBot.prototype.init = function () {
    console.log("正在初始化 Bot...");

    if (!requestScreenCapture(true)) {
        toastLog("请求截图失败，停止运行");
        exit();
    }

    // 预加载所有模板
    let templatesToLoad = ["chat", "capture", "capture_abandon", "skill_x", "escape_btn", "escape_yes"];
    templatesToLoad.forEach(name => {
        this.tpls[name] = vision.loadTemplate(name);
    });

    console.log("初始化完成！当前运行模式:", this.mode);
    sleep(1000);
};

AutoRocoBot.prototype.run = function () {
    console.log("-> 启动监控循环...");

    while (true) {
        if (this.isPaused) {
            sleep(1000);
            continue;
        }

        let screenImg = captureScreen();
        if (!screenImg) {
            sleep(config.POLL_INTERVAL_MS);
            continue;
        }

        // ---- 1. 匹配模板确定当前状态 ----
        let detectedState = "其他";
        
        // 依次匹配，确定当前界面状态
        let chatMatch = vision.matchTemplateWithScales(screenImg, this.tpls["chat"], config.TEMPLATE_MATCH_THRESHOLD);
        if (chatMatch) {
            detectedState = "非战斗";
        } else {
            let abandonMatch = vision.matchTemplateWithScales(screenImg, this.tpls["capture_abandon"], config.TEMPLATE_MATCH_THRESHOLD, true);
            let captureMatch = vision.matchTemplateWithScales(screenImg, this.tpls["capture"], config.TEMPLATE_MATCH_THRESHOLD, true);

            if (abandonMatch && captureMatch) {
                // 两者都匹配到了，比较得分
                if (abandonMatch.score >= captureMatch.score) {
                    detectedState = "有效战斗";
                } else {
                    detectedState = "无效战斗";
                }
            } else if (abandonMatch) {
                detectedState = "有效战斗";
            } else if (captureMatch) {
                detectedState = "无效战斗";
            }
        }

        console.verbose(`[状态检测] 当前检测状态: ${detectedState} | 上次非其他状态: ${this.lastNonOtherState} | 锁定战斗状态: ${this.effectiveBattleState || "无"}`);

        // ---- 2. 向上追溯与状态锁定逻辑 ----
        if (detectedState === "有效战斗" || detectedState === "无效战斗") {
            // 如果上一次非其他状态是“非战斗”，说明刚刚进入战斗，锁定当前战斗状态为第一次检测到的状态
            if (this.lastNonOtherState === "非战斗") {
                this.effectiveBattleState = detectedState;
                console.log(`[状态机] 从非战斗进入战斗，锁定有效战斗状态为: ${this.effectiveBattleState}`);
            }

            // 根据锁定的有效战斗状态执行动作
            if (this.effectiveBattleState === "有效战斗") {
                let loc = this.cachedSkillXLoc || vision.matchTemplateWithScales(screenImg, this.tpls["skill_x"], config.TEMPLATE_MATCH_THRESHOLD);
                if (loc) {
                    if (!this.cachedSkillXLoc) {
                        this.cachedSkillXLoc = loc;
                        console.log("-> 首次匹配 skill_x 成功，已持久化坐标");
                    }
                    console.log("-> 匹配到有效战斗，执行 [技能点击]");
                    inputHandler.clickSkillX(loc);
                } else {
                    console.verbose("-> 有效战斗，但未找到 skill_x 模板");
                }
            } else if (this.effectiveBattleState === "无效战斗") {
                let loc = this.cachedEscapeBtnLoc || vision.matchTemplateWithScales(screenImg, this.tpls["escape_btn"], config.TEMPLATE_MATCH_THRESHOLD);
                if (loc) {
                    if (!this.cachedEscapeBtnLoc) {
                        this.cachedEscapeBtnLoc = loc;
                        console.log("-> 首次匹配 escape_btn 成功，已持久化坐标");
                    }
                    console.log("-> 匹配到无效战斗，执行 [逃跑点击]");
                    inputHandler.clickEscape(loc);
                    sleep(1000); // 等待确认弹窗

                    let confirmScreen = captureScreen();
                    if (confirmScreen) {
                        let yesLoc = vision.matchTemplateWithScales(confirmScreen, this.tpls["escape_yes"], config.ESCAPE_YES_THRESHOLD);
                        if (yesLoc) {
                            console.log("-> 找到逃跑确认按钮，执行 [确认点击]");
                            inputHandler.clickConfirmYes(yesLoc);
                        } else {
                            console.warn("-> 未找到逃跑确认(是)按钮");
                        }
                        confirmScreen.recycle();
                    }
                    sleep(2000); // 等待逃跑动画
                } else {
                    console.verbose("-> 无效战斗，但未找到 escape_btn 模板");
                }
            }
        } else if (detectedState === "非战斗") {
            // 回到非战斗界面，重置战斗锁定状态
            if (this.effectiveBattleState !== null) {
                console.log("[状态机] 检测到非战斗状态，重置锁定战斗状态");
                this.effectiveBattleState = null;
            }
        }

        // ---- 3. 维持上一次非其他状态记录 ----
        if (detectedState !== "其他") {
            this.lastNonOtherState = detectedState;
        }

        screenImg.recycle();
        sleep(config.POLL_INTERVAL_MS);
    }
};

module.exports = AutoRocoBot;
