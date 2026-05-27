"ui";

var storage = storages.create("auto_roco_config");
var AutoRocoBot = require("./src/bot.js");

// 尝试解除 Auto.js6 默认的音量下键停止脚本绑定
try {
    $settings.setEnabled('stop_all_on_volume_down', false);
} catch (e) {
    console.error("无法解除音量下键绑定: " + e);
}

ui.layout(
    <scroll bg="#F5F7FA">
        <vertical padding="16 24">
            <!-- Header -->
            <vertical gravity="center" margin="0 0 0 24">
                <text text="Auto-Roco" textSize="32sp" textColor="#6200EE" textStyle="bold" />
                <text text="智能化多功能挂机助手" textSize="14sp" textColor="#888888" margin="0 4 0 0"/>
            </vertical>

            <!-- Dashboard Card -->
            <card w="*" h="auto" margin="0 0 0 16" cardElevation="4dp" cardCornerRadius="16dp" cardBackgroundColor="#FFFFFF">
                <vertical padding="20">
                    <horizontal gravity="center_vertical">
                        <vertical layout_weight="1">
                            <text text="今日有效战斗" textSize="14sp" textColor="#888888"/>
                            <text id="txt_valid_battles" text="0" textSize="36sp" textColor="#6200EE" textStyle="bold" margin="0 4 0 0"/>
                        </vertical>
                        <button id="btn_clear_battles" text="重置" textSize="14sp" textColor="#F44336" style="Widget.AppCompat.Button.Borderless" margin="0"/>
                    </horizontal>
                    <view bg="#E0E0E0" h="1dp" w="*" margin="0 16"/>
                    <horizontal gravity="center_vertical" margin="0 0 0 16">
                        <text text="当前模式:" textSize="16sp" textColor="#333333" layout_weight="1"/>
                        <spinner id="sp_mode" entries="1: 聚能模式|2: 逃跑模式|3: 智能模式|4: 攻击模式" w="140"/>
                    </horizontal>
                    <button id="btn_start" text="启动挂机" textSize="18sp" textColor="#FFFFFF" style="Widget.AppCompat.Button.Colored" bg="#6200EE" w="*" h="56"/>
                </vertical>
            </card>

            <!-- Permissions Card -->
            <card w="*" h="auto" margin="0 0 0 16" cardElevation="2dp" cardCornerRadius="16dp" cardBackgroundColor="#FFFFFF">
                <vertical padding="20">
                    <text text="系统权限" textSize="18sp" textColor="#333333" textStyle="bold" margin="0 0 0 12"/>
                    <horizontal>
                        <button id="btn_acc" text="无障碍" layout_weight="1" style="Widget.AppCompat.Button.Colored" margin="0 0 8 0"/>
                        <button id="btn_float" text="悬浮窗" layout_weight="1" style="Widget.AppCompat.Button.Colored" margin="8 0 0 0"/>
                    </horizontal>
                </vertical>
            </card>

            <!-- Basic Settings Card -->
            <card w="*" h="auto" margin="0 0 0 16" cardElevation="2dp" cardCornerRadius="16dp" cardBackgroundColor="#FFFFFF">
                <vertical padding="20">
                    <text text="基础配置" textSize="18sp" textColor="#333333" textStyle="bold" margin="0 0 0 16"/>
                    
                    <horizontal gravity="center_vertical" margin="0 0 0 12">
                        <text text="轮询间隔" textSize="16sp" textColor="#555555" layout_weight="1"/>
                        <input id="input_poll" inputType="number" text="3000" w="80" gravity="center" textSize="16sp" bg="#F0F0F0" padding="4"/>
                        <text text="ms" textSize="14sp" textColor="#888888" margin="8 0 0 0"/>
                    </horizontal>
                    
                    <horizontal gravity="center_vertical" margin="0 0 0 12">
                        <text text="匹配阈值" textSize="16sp" textColor="#555555" layout_weight="1"/>
                        <input id="input_threshold" inputType="numberDecimal" text="0.7" w="80" gravity="center" textSize="16sp" bg="#F0F0F0" padding="4"/>
                        <text text="0~1" textSize="14sp" textColor="#888888" margin="8 0 0 0"/>
                    </horizontal>
                    
                    <horizontal gravity="center_vertical" margin="0 0 0 16">
                        <vertical layout_weight="1">
                            <text text="自动接受组队" textSize="16sp" textColor="#555555"/>
                            <text text="非战斗时自动匹配并点击" textSize="12sp" textColor="#888888"/>
                        </vertical>
                        <switch id="sw_auto_accept_team" checked="true"/>
                    </horizontal>

                    <horizontal>
                        <button id="btn_save" text="保存参数" layout_weight="1" margin="0 0 8 0"/>
                        <button id="btn_clear_cache" text="清除缓存" layout_weight="1" style="Widget.AppCompat.Button.Colored" bg="#FF9800" margin="8 0 0 0"/>
                    </horizontal>
                </vertical>
            </card>

            <!-- Advanced Settings Card -->
            <card w="*" h="auto" margin="0 0 0 16" cardElevation="2dp" cardCornerRadius="16dp" cardBackgroundColor="#FFFFFF">
                <vertical padding="20">
                    <text text="高级攻击模式配置" textSize="18sp" textColor="#333333" textStyle="bold" margin="0 0 0 16"/>
                    
                    <horizontal gravity="center_vertical" margin="0 0 0 12">
                        <text text="自定义坐标" textSize="16sp" textColor="#555555" layout_weight="1"/>
                        <text text="X:" textSize="14sp" textColor="#888888" margin="0 0 4 0"/>
                        <input id="input_custom_x" inputType="number" text="0" w="50" gravity="center" bg="#F0F0F0" padding="4"/>
                        <text text="Y:" textSize="14sp" textColor="#888888" margin="12 0 4 0"/>
                        <input id="input_custom_y" inputType="number" text="0" w="50" gravity="center" bg="#F0F0F0" padding="4"/>
                    </horizontal>

                    <horizontal gravity="center_vertical" margin="0 0 0 12">
                        <text text="后续动作" textSize="16sp" textColor="#555555" layout_weight="1"/>
                        <spinner id="sp_custom_action" entries="0: 聚能|1: 重复攻击" w="120"/>
                    </horizontal>

                    <horizontal gravity="center_vertical">
                        <vertical layout_weight="1">
                            <text text="智能转为聚能" textSize="16sp" textColor="#555555"/>
                            <text text="检测到可捕捉时停止攻击" textSize="12sp" textColor="#888888"/>
                        </vertical>
                        <switch id="sw_stop_when_catchable" checked="true"/>
                    </horizontal>
                </vertical>
            </card>
            
        </vertical>
    </scroll>
);

// 初始化 UI 数据
ui.input_poll.setText(storage.get("POLL_INTERVAL_MS", 3000).toString());
ui.input_threshold.setText(storage.get("TEMPLATE_MATCH_THRESHOLD", 0.7).toString());
ui.sp_mode.setSelection(storage.get("LAST_MODE_INDEX", 2)); // 默认选择“智能模式”(索引2)
ui.input_custom_x.setText(storage.get("CUSTOM_ATTACK_X", 0).toString());
ui.input_custom_y.setText(storage.get("CUSTOM_ATTACK_Y", 0).toString());
ui.sp_custom_action.setSelection(storage.get("CUSTOM_SUBSEQUENT_ACTION", 0));
ui.sw_stop_when_catchable.setChecked(storage.get("CUSTOM_STOP_WHEN_CATCHABLE", true));
ui.sw_auto_accept_team.setChecked(storage.get("AUTO_ACCEPT_TEAM", true));

// 权限状态更新
function updatePermissionStatus() {
    if (auto.service) {
        ui.btn_acc.setText("无障碍服务 (已开启)");
        ui.btn_acc.attr("bg", "#4CAF50");
    } else {
        ui.btn_acc.setText("开启无障碍服务 (未开启)");
        ui.btn_acc.attr("bg", "#F44336");
    }

    if (android.provider.Settings.canDrawOverlays(context)) {
        ui.btn_float.setText("悬浮窗权限 (已开启)");
        ui.btn_float.attr("bg", "#4CAF50");
    } else {
        ui.btn_float.setText("开启悬浮窗权限 (未开启)");
        ui.btn_float.attr("bg", "#F44336");
    }
}

function updateBattleCountDisplay() {
    let today = new Date().toDateString();
    let savedDate = storage.get("VALID_BATTLE_DATE", "");
    let count = storage.get("VALID_BATTLE_COUNT", 0);
    if (savedDate !== today) {
        count = 0;
        storage.put("VALID_BATTLE_DATE", today);
        storage.put("VALID_BATTLE_COUNT", count);
    }
    ui.txt_valid_battles.setText(count.toString());
}

ui.btn_clear_battles.click(() => {
    storage.put("VALID_BATTLE_COUNT", 0);
    storage.put("VALID_BATTLE_DATE", new Date().toDateString());
    updateBattleCountDisplay();
    toastLog("战斗次数已清空");
});

// 每次界面恢复时刷新权限状态和统计
ui.emitter.on("resume", function() {
    updatePermissionStatus();
    updateBattleCountDisplay();
});

// 监听后台事件更新
events.broadcast.on("valid_battle_count_changed", function(count) {
    ui.run(() => {
        ui.txt_valid_battles.setText(count.toString());
    });
});

// 初始化刷新一次
updatePermissionStatus();
updateBattleCountDisplay();

// 权限引导
ui.btn_acc.click(() => {
    app.startActivity({
        action: "android.settings.ACCESSIBILITY_SETTINGS"
    });
    toastLog("请在设置中开启本应用的无障碍服务");
});

ui.btn_float.click(() => {
    let intent = new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        android.net.Uri.parse("package:" + context.getPackageName()));
    app.startActivity(intent);
    toastLog("请在设置中允许显示在其他应用上层");
});

// 保存配置
ui.btn_save.click(() => {
    storage.put("POLL_INTERVAL_MS", parseInt(ui.input_poll.text()) || 3000);
    storage.put("TEMPLATE_MATCH_THRESHOLD", parseFloat(ui.input_threshold.text()) || 0.7);
    storage.put("LAST_MODE_INDEX", ui.sp_mode.getSelectedItemPosition());
    storage.put("CUSTOM_ATTACK_X", parseInt(ui.input_custom_x.text()) || 0);
    storage.put("CUSTOM_ATTACK_Y", parseInt(ui.input_custom_y.text()) || 0);
    storage.put("CUSTOM_SUBSEQUENT_ACTION", ui.sp_custom_action.getSelectedItemPosition());
    storage.put("CUSTOM_STOP_WHEN_CATCHABLE", ui.sw_stop_when_catchable.isChecked());
    storage.put("AUTO_ACCEPT_TEAM", ui.sw_auto_accept_team.isChecked());
    toastLog("配置已保存");
});

// 清除坐标缓存
ui.btn_clear_cache.click(() => {
    storage.remove("loc_skill_x");
    storage.remove("loc_escape_btn");
    storage.remove("loc_escape_yes");
    toastLog("坐标缓存已清除，下一次将重新匹配模板");
});

// 运行控制
var botThread = null;

ui.btn_start.click(() => {
    if (botThread && botThread.isAlive()) {
        toastLog("脚本已经在运行中");
        return;
    }

    if (!auto.service) {
        toastLog("请先开启无障碍服务！");
        return;
    }

    if (!android.provider.Settings.canDrawOverlays(context)) {
        toastLog("请先开启悬浮窗权限！");
        return;
    }

    // 确保启动前保存最新配置
    ui.btn_save.performClick();

    let modeIndex = ui.sp_mode.getSelectedItemPosition();
    let modeValue = (modeIndex + 1).toString(); // "1", "2", "3" 或 "4"

    botThread = threads.start(function() {
        console.log("=== Auto-Roco 启动 ===");
        
        let FloatyManager = require("./src/floaty_manager.js");
        let bot = new AutoRocoBot(modeValue);

        // 初始化悬浮窗并绑定 bot 状态
        FloatyManager.init(bot, botThread);

        bot.init();
        bot.run();
    });
    toastLog("脚本已启动");
});
