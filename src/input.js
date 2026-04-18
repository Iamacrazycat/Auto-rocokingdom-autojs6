/**
 * 封装的 Android 端点击操作
 * 参数 x, y 可以来自 vision.js 中算出来的特征匹配中心点
 */

/**
 * 带有随机偏移的模拟点击，防止被检测封号
 * @param {Number} x 中心X坐标
 * @param {Number} y 中心Y坐标
 * @param {Number} offset 随机偏移像素范围
 */
function safeClick(x, y, offset = 10) {
    let rx = Math.floor(x + (Math.random() * offset * 2 - offset));
    let ry = Math.floor(y + (Math.random() * offset * 2 - offset));
    
    // 确保坐标不为负数
    rx = Math.max(0, rx);
    ry = Math.max(0, ry);
    
    console.verbose(`执行物理点击坐标: (${rx}, ${ry})`);
    
    try {
        click(rx, ry);
    } catch(e) {
        console.error("点击执行失败，请检查无障碍服务权限: " + e);
    }
}

/**
 * 点击"聚能" (技能界面的技能/X位) 按钮
 * @param {Object} loc 由 vision 返回的 {x, y} 位置
 */
function clickSkillX(loc) {
    if (!loc) {
        console.warn("未能提供聚能按钮特征点位置，跳过点击");
        return;
    }
    console.log("-> 触发 聚能 动作点击...");
    safeClick(loc.x, loc.y);
}

/**
 * 点击"逃跑"按钮
 * @param {Object} loc 
 */
function clickEscape(loc) {
    if (!loc) {
        console.warn("未能提供逃跑按钮特征点位置，跳过点击");
        return;
    }
    console.log("-> 触发 逃跑 点击...");
    safeClick(loc.x, loc.y);
}

/**
 * 点击"是"（确认逃跑）按钮
 * @param {Object} loc 
 */
function clickConfirmYes(loc) {
    if (!loc) {
        console.warn("未能提供确认(是)按钮特征点位置，跳过点击");
        return;
    }
    console.log("-> 点击 确定(是) 按钮...");
    safeClick(loc.x, loc.y);
}

module.exports = {
    clickSkillX: clickSkillX,
    clickEscape: clickEscape,
    clickConfirmYes: clickConfirmYes
};
