/* =====================================================================
 * ⏩ 倍速模组 speed-mod-v1.js  v1.0.0
 * 特性：侧边栏新增倍速控制面板，游戏速度可调 0.01x ~ 1000x
 *   - 预设按钮：0.01x / 0.5x / 1x / 10x / 100x / 1000x
 *   - 对数滑块：1x → 1000x 平滑调节
 *   - 输入框：可精确输入 0.01~1000 任意值
 *   - 与顶部 ⏩ 速度 chip 联动显示
 * 加载方式：游戏内「🧩 模组」→「📂 加载模组(.js)」选择本文件
 * ===================================================================== */
(function () {
  'use strict';

  Dog.Mods.register({
    id: 'speed-mod',
    name: '⏩ 倍速模组（0.01x-1000x）',
    version: '1.0.0',
    desc: '侧边栏新增倍速面板：预设按钮 + 对数滑块 + 输入框，游戏速度可调 0.01 ~ 1000 倍速。',

    onLoad(D) {
      if (!D.setSpeed) { log('⚠ 倍速模组需要主程序 v3.2+（Dog.setSpeed）'); return; }
      const side = document.querySelector('.side');
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>⏩ 倍速控制 <small style="color:var(--sub)">v1.0</small></h3>
        <div class="lblrow"><span>当前速度</span><b id="spdVal" style="color:var(--acc)">1x</b></div>
        <input type="range" id="spdRange" min="1" max="1000" value="10" style="width:100%">
        <div class="row" style="margin-top:6px;flex-wrap:wrap">
          <button class="ghost" onclick="__spdSet(0.01)">0.01x</button>
          <button class="ghost" onclick="__spdSet(0.5)">0.5x</button>
          <button class="ghost" onclick="__spdSet(1)">1x</button>
          <button class="ghost" onclick="__spdSet(10)">10x</button>
          <button class="ghost" onclick="__spdSet(100)">100x</button>
          <button class="ghost" onclick="__spdSet(1000)">1000x</button>
        </div>
        <div class="row" style="margin-top:6px">
          <input type="number" id="spdNum" min="0.01" max="1000" step="0.01" value="1" style="flex:1;min-width:0">
          <button class="blue" onclick="__spdApply()">应用</button>
        </div>
        <div class="note" style="margin-top:4px">滑块为对数刻度（1→1000）；输入框可填 0.01~1000 任意值。100x 以上画面会剧烈加速，属正常现象。</div>`;
      side.appendChild(card);

      window.__spdSet = function (x) { D.setSpeed(x); sync(); };
      window.__spdApply = function () {
        const v = parseFloat($('spdNum').value);
        if (isFinite(v)) D.setSpeed(v); sync();
      };
      function sync() {
        const v = +S.speed.toFixed(3);
        $('spdVal').textContent = v + 'x';
        $('spdRange').value = Math.min(1000, Math.max(1, Math.round(1 + Math.log10(Math.max(1, v)) / 3 * 999)));
        $('spdNum').value = v;
      }
      $('spdRange').addEventListener('input', function () {
        const r = +this.value;
        D.setSpeed(Math.pow(10, (r - 1) / 999 * 3));
        sync();
      });
      sync();
      log('⏩ 倍速模组已就绪：0.01x ~ 1000x 可调');
    },

    onUnload() {
      const el = $('spdRange'); if (el && el.closest('.card')) el.closest('.card').remove();
      delete window.__spdSet; delete window.__spdApply;
    }
  });
})();
