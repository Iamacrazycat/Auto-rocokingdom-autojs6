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
    <scroll>
        <vertical padding="16">
            <text text="Auto-Roco 自动化挂机" textSize="24sp" textColor="#000000" textStyle="bold" gravity="center" margin="0 0 0 16"/>

            <card w="*" h="auto" margin="0 0 0 16" cardElevation="2dp" cardCornerRadius="4dp">
                <vertical padding="16">
                    <text text="权限设置" textSize="18sp" textColor="#333333" textStyle="bold" margin="0 0 0 8"/>
                    <button id="btn_acc" text="开启无障碍服务" style="Widget.AppCompat.Button.Colored"/>
                    <button id="btn_float" text="开启悬浮窗权限" style="Widget.AppCompat.Button.Colored"/>
                </vertical>
            </card>

            <card w="*" h="auto" margin="0 0 0 16" cardElevation="2dp" cardCornerRadius="4dp">
                <vertical padding="16">
                    <text text="参数配置" textSize="18sp" textColor="#333333" textStyle="bold" margin="0 0 0 8"/>
                    
                    <horizontal margin="0 4">
                        <text text="轮询间隔(ms):" w="120" gravity="center_vertical"/>
                        <input id="input_poll" inputType="number" text="3000" w="*"/>
                    </horizontal>
                    
                    <horizontal margin="0 4">
                        <text text="模板匹配阈值:" w="120" gravity="center_vertical"/>
                        <input id="input_threshold" inputType="numberDecimal" text="0.7" w="*"/>
                    </horizontal>
                    
                    <horizontal margin="0 8 0 0">
                        <button id="btn_save" text="保存配置" w="0" layout_weight="1"/>
                        <button id="btn_clear_cache" text="清除坐标缓存" w="0" layout_weight="1" style="Widget.AppCompat.Button.Colored" bg="#FF9800"/>
                    </horizontal>
                </vertical>
            </card>

            <card w="*" h="auto" margin="0 0 0 16" cardElevation="2dp" cardCornerRadius="4dp">
                <vertical padding="16">
                    <text text="攻击模式配置" textSize="18sp" textColor="#333333" textStyle="bold" margin="0 0 0 8"/>
                    
                    <horizontal margin="0 4">
                        <text text="自定义攻击 X:" w="120" gravity="center_vertical"/>
                        <input id="input_custom_x" inputType="number" text="0" w="*"/>
                    </horizontal>
                    
                    <horizontal margin="0 4">
                        <text text="自定义攻击 Y:" w="120" gravity="center_vertical"/>
                        <input id="input_custom_y" inputType="number" text="0" w="*"/>
                    </horizontal>

                    <horizontal margin="0 4">
                        <text text="后续动作:" gravity="center_vertical" margin="0 0 8 0"/>
                        <spinner id="sp_custom_action" entries="0: 聚能|1: 重复攻击" w="*"/>
                    </horizontal>

                    <checkbox id="cb_stop_when_catchable" text="检测到可捕捉(红标消失)时自动转为聚能" checked="true" margin="0 4"/>
                </vertical>
            </card>

            <card w="*" h="auto" margin="0 0 0 16" cardElevation="2dp" cardCornerRadius="4dp">
                <vertical padding="16">
                    <text text="运行控制" textSize="18sp" textColor="#333333" textStyle="bold" margin="0 0 0 8"/>
                    <horizontal margin="0 0 0 8">
                        <text text="选择模式:" gravity="center_vertical" margin="0 0 8 0"/>
                        <spinner id="sp_mode" entries="1: 聚能模式|2: 逃跑模式|3: 智能模式|4: 攻击模式" w="*"/>
                    </horizontal>
                    <button id="btn_start" text="启动脚本" style="Widget.AppCompat.Button.Colored" bg="#4CAF50"/>
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
ui.cb_stop_when_catchable.setChecked(storage.get("CUSTOM_STOP_WHEN_CATCHABLE", true));

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

// 每次界面恢复时刷新权限状态
ui.emitter.on("resume", function() {
    updatePermissionStatus();
});

// 初始化刷新一次
updatePermissionStatus();

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
    storage.put("CUSTOM_STOP_WHEN_CATCHABLE", ui.cb_stop_when_catchable.isChecked());
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
