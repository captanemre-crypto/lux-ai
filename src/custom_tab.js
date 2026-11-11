// Sol panel özelleştirmeleri altına eklenen sekme
const customTab = document.createElement('div');
customTab.className = 'custom-tab-item';
customTab.innerHTML = '<span>Özel Sekme</span>';
customTab.style.cssText = 'padding: 8px 12px; margin: 4px 0; background: rgba(255,255,255,0.05); border-radius: 6px; cursor: pointer; color: #fff; font-size: 14px;';

const targetArea = document.querySelector('.sidebar-section') || document.body;
targetArea.appendChild(customTab);
console.log('Özel sekme başarıyla arayüze eklendi!');
