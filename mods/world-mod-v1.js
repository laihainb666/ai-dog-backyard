/* =====================================================================
 * 🌍 更大的院子模组 world-mod-v1.js  v1.0.0
 * 特性：装载后右上角出现「🌍 扩大院子 ×10」按钮
 *   - 点击一次，世界认知扩大为原先的 10 倍（可无限叠加）
 *   - 主程序 v3.2+ 提供动态世界与相机跟随：狗/猫可探索更大的院子
 *   - 背景（草地/栅栏/天空/雨雪）按世界尺寸自动铺满
 * 加载方式：游戏内「🧩 模组」→「📂 加载模组(.js)」选择本文件
 * ===================================================================== */
(function () {
  'use strict';

  Dog.Mods.register({
    id: 'world-mod',
    name: '🌍 更大的院子（世界扩大）',
    version: '1.0.0',
    desc: '右上角出现按钮，点击将世界认知扩大 10 倍，可叠加；配合相机跟随探索更大院子。',

    onLoad(D) {
      if (!D.setWorld) { log('⚠ 世界模组需要主程序 v3.2+（Dog.setWorld）'); return; }
      const btn = document.createElement('button');
      btn.id = 'worldBtn';
      btn.textContent = '🌍 扩大院子 ×10';
      Object.assign(btn.style, {
        position: 'fixed', top: '12px', right: '12px', zIndex: '999',
        background: 'linear-gradient(135deg,#2ecc71,#1abc9c)', color: '#fff', border: 'none',
        borderRadius: '20px', padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
        boxShadow: '0 3px 10px rgba(0,0,0,.28)', transition: 'transform .15s'
      });
      btn.onmouseenter = () => { btn.style.transform = 'scale(1.06)'; };
      btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
      btn.onclick = function () {
        const b = D.getBounds();
        const r = D.setWorld(b.w * 10, b.h * 10);
        toasty('🌍 世界认知 ×10 → ' + r.w + ' × ' + r.h);
        log('🌍 院子已扩大 10 倍：' + b.w + '×' + b.h + ' → ' + r.w + '×' + r.h + '（可继续叠加）');
      };
      document.body.appendChild(btn);
      this._btn = btn;
      log('🌍 世界模组已加载：右上角按钮可把院子扩大 10 倍，可叠加');
    },

    onUnload() {
      const b = document.getElementById('worldBtn'); if (b) b.remove();
    }
  });
})();
