// Sol sütuna 'Özelleştirilmiş' altına eklenecek sekme bileşeni
const customTab = document.createElement('div');
customTab.className = 'custom-tab-item';
customTab.innerHTML = '<span>🌟 Özel Sekme</span>';
customTab.style.cssText = 'padding: 8px 12px; margin-top: 5px; cursor: pointer; border-radius: 6px; background: rgba(255,255,255,0.05); color: #fff;';

// Hedef elementin altına ekleme
const target = document.querySelector('.customized-section') || document.querySelector('aside');
if (target) {
    target.appendChild(customTab);
    console.log('Özel sekme başarıyla arayüze eklendi!');
} else {
    console.log('Hedef alan bulunamadı.');
}