var config = require("../config.js");
var vision = require("./vision.js");
var inputHandler = require("./input.js");

var storage = storages.create("auto_roco_config");

function AutoRocoBot(mode) {
    this.mode = mode; // Keep mode if it's used somewhere else, though we use state machine now
    this.tpls = {};
    
    // 状态机变量
    this.lastNonOtherState = "非战斗"; // 初始假设为非战斗
    this.effectiveBattleState = null;   // 锁定当前战斗的有效状态（"有效战斗" 或 "无效战斗"）
    this.battleActionCount = 0;         // 记录当前战斗中执行的动作回合数

    // 从本地存储加载持久化的坐标
    this.cachedSkillXLoc = storage.get("loc_skill_x", null);
    this.cachedEscapeBtnLoc = storage.get("loc_escape_btn", null);
    this.cachedEscapeYesLoc = storage.get("loc_escape_yes", null);

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
    let templatesToLoad = ["chat", "capture", "capture_abandon", "skill_x", "escape_btn", "escape_yes", "daidaini"];
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

            let bestMatch = null;
            if (abandonMatch && captureMatch) {
                bestMatch = abandonMatch.score > captureMatch.score ? abandonMatch : captureMatch;
            } else if (abandonMatch) {
                bestMatch = abandonMatch;
            } else if (captureMatch) {
                bestMatch = captureMatch;
            }

            if (bestMatch) {
                // 只要选出了最优的形状匹配，直接看它区域内的红色像素数量 (targetPx)
                // 如果含有大量红色像素 (> 30)，不管是哪个模板匹配上的，都说明是红色的污染精灵
                if (bestMatch.targetPx > config.MARKER_MAX_EXTRA_PIXELS) {
                    detectedState = "有效战斗";
                } else {
                    detectedState = "无效战斗";
                }
            }
        }

        console.verbose(`[状态检测] 当前检测状态: ${detectedState} | 上次非其他状态: ${this.lastNonOtherState} | 锁定战斗状态: ${this.effectiveBattleState || "无"}`);

        // ---- 2. 向上追溯与状态锁定逻辑 ----
        if (detectedState === "有效战斗" || detectedState === "无效战斗") {
            // 如果上一次非其他状态是“非战斗”，说明刚刚进入战斗，锁定当前战斗状态为第一次检测到的状态
            if (this.lastNonOtherState === "非战斗") {
                this.effectiveBattleState = detectedState;
                console.log(`[状态机] 从非战斗进入战斗，锁定有效战斗状态为: ${this.effectiveBattleState}`);
                if (detectedState === "有效战斗") {
                    this.incrementValidBattleCount();
                }
            }

            // 根据锁定的有效战斗状态执行动作
            let actionToTake = "none";
            if (this.mode === "1") {
                actionToTake = "skill_x"; // 聚能模式：不管有效无效，都点击聚能
            } else if (this.mode === "2") {
                actionToTake = "escape";  // 逃跑模式：不管有效无效，都点击逃跑
            } else if (this.mode === "4") {
                if (this.effectiveBattleState === "有效战斗") {
                    if (config.CUSTOM_STOP_WHEN_CATCHABLE && detectedState === "无效战斗") {
                        actionToTake = "skill_x"; // 变为可捕捉，停止攻击并聚能
                    } else {
                        actionToTake = "custom"; // 依然不可捕捉，继续自定义动作
                    }
                } else {
                    actionToTake = "escape"; // 锁定为无效战斗则直接逃跑
                }
            } else {
                actionToTake = this.effectiveBattleState === "有效战斗" ? "skill_x" : "escape"; // 智能模式
            }

            if (actionToTake === "skill_x") {
                let loc = this.cachedSkillXLoc || vision.matchTemplateWithScales(screenImg, this.tpls["skill_x"], config.TEMPLATE_MATCH_THRESHOLD);
                if (loc) {
                    if (!this.cachedSkillXLoc) {
                        this.cachedSkillXLoc = loc;
                        storage.put("loc_skill_x", loc);
                        console.log("-> 首次匹配 skill_x 成功，已持久化坐标至本地");
                    }
                    console.log("-> 执行 [技能(聚能)点击]");
                    inputHandler.clickSkillX(loc);
                } else {
                    console.verbose("-> 未找到 skill_x 模板");
                }
            } else if (actionToTake === "custom") {
                if (this.battleActionCount === 0) {
                    console.log("-> 攻击模式(第1回合)，执行 [自定义点击]");
                    inputHandler.clickCustom(config.CUSTOM_ATTACK_X, config.CUSTOM_ATTACK_Y);
                    this.battleActionCount++;
                } else {
                    if (config.CUSTOM_SUBSEQUENT_ACTION === 0) {
                        let loc = this.cachedSkillXLoc || vision.matchTemplateWithScales(screenImg, this.tpls["skill_x"], config.TEMPLATE_MATCH_THRESHOLD);
                        if (loc) {
                            if (!this.cachedSkillXLoc) {
                                this.cachedSkillXLoc = loc;
                                storage.put("loc_skill_x", loc);
                                console.log("-> 首次匹配 skill_x 成功，已持久化坐标至本地");
                            }
                            console.log(`-> 攻击模式(第${this.battleActionCount+1}回合，后续:聚能)，执行 [技能点击]`);
                            inputHandler.clickSkillX(loc);
                        } else {
                            console.verbose("-> 攻击模式(后续聚能)，但未找到 skill_x 模板");
                        }
                    } else {
                        console.log(`-> 攻击模式(第${this.battleActionCount+1}回合，后续:重复)，执行 [自定义点击]`);
                        inputHandler.clickCustom(config.CUSTOM_ATTACK_X, config.CUSTOM_ATTACK_Y);
                    }
                    this.battleActionCount++;
                }
            } else if (actionToTake === "escape") {
                let loc = this.cachedEscapeBtnLoc || vision.matchTemplateWithScales(screenImg, this.tpls["escape_btn"], config.TEMPLATE_MATCH_THRESHOLD);
                if (loc) {
                    if (!this.cachedEscapeBtnLoc) {
                        this.cachedEscapeBtnLoc = loc;
                        storage.put("loc_escape_btn", loc);
                        console.log("-> 首次匹配 escape_btn 成功，已持久化坐标至本地");
                    }
                    console.log("-> 执行 [逃跑点击]");
                    inputHandler.clickEscape(loc);
                    
                    // 额外增加的延迟，等待逃跑确认弹窗完全弹出（由于有坐标缓存，可以适当缩短）
                    sleep(500); 

                    let yesLoc = this.cachedEscapeYesLoc;
                    if (!yesLoc) {
                        let confirmScreen = captureScreen();
                        if (confirmScreen) {
                            yesLoc = vision.matchTemplateWithScales(confirmScreen, this.tpls["escape_yes"], config.ESCAPE_YES_THRESHOLD);
                            if (yesLoc) {
                                this.cachedEscapeYesLoc = yesLoc;
                                storage.put("loc_escape_yes", yesLoc);
                                console.log("-> 首次匹配 escape_yes 成功，已持久化坐标至本地");
                            }
                            confirmScreen.recycle();
                        }
                    }

                    if (yesLoc) {
                        console.log("-> 执行 [逃跑确认(是)点击]");
                        inputHandler.clickConfirmYes(yesLoc);
                    } else {
                        console.warn("-> 未找到逃跑确认(是)按钮");
                    }
                    
                    sleep(2000); // 等待逃跑动画
                } else {
                    console.verbose("-> 未找到 escape_btn 模板");
                }
            }
        } else if (detectedState === "非战斗") {
            // 回到非战斗界面，重置战斗锁定状态
            if (this.effectiveBattleState !== null) {
                console.log("[状态机] 检测到非战斗状态，重置锁定战斗状态和动作回合");
                this.effectiveBattleState = null;
                this.battleActionCount = 0;
            }

            // 自动接受组队
            if (config.AUTO_ACCEPT_TEAM) {
                let hsvOpt = { color: "#da9924", hueTol: 10, satTol: 60, valTol: 60 };
                let daidainiLoc = vision.matchTemplateWithScales(screenImg, this.tpls["daidaini"], config.TEMPLATE_MATCH_THRESHOLD, hsvOpt);
                if (daidainiLoc && (daidainiLoc.targetPx > 10 || daidainiLoc.markerScore > 0.1)) {
                    console.log("-> 匹配到 daidaini 且包含特定色彩特征，执行点击接受组队");
                    inputHandler.clickAcceptTeam(daidainiLoc);
                    sleep(1000); // 稍微等待一下
                }
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

AutoRocoBot.prototype.incrementValidBattleCount = function() {
    let today = new Date().toDateString();
    let savedDate = storage.get("VALID_BATTLE_DATE", "");
    let count = storage.get("VALID_BATTLE_COUNT", 0);

    if (savedDate !== today) {
        count = 0;
        storage.put("VALID_BATTLE_DATE", today);
    }
    
    count++;
    storage.put("VALID_BATTLE_COUNT", count);
    console.log(`[统计] 今日有效战斗次数: ${count}`);
    
    // 通知UI或悬浮窗更新
    events.broadcast.emit("valid_battle_count_changed", count);
};

module.exports = AutoRocoBot;
