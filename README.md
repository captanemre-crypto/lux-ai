# ⚡ Lux AI - Agentic Desktop Application & IDE

Google Antigravity mimarisinin **birebir arayüzü, görsel teması, renk paleti (`#070709`) ve yerleşimleri** baz alınarak geliştirilmiş, tamamen özelleştirilebilir masaüstü yapay zeka ve IDE uygulaması.

---

## 🎨 Tasarım ve Arayüz Uyumu (1:1 Antigravity)

1. **Üst Pencere & Menü Çubuğu (`titlebar`):**
   - Windows yerel çerçevesiyle entegre `titleBarOverlay` (#070709)
   - `Lux AI`, `Workspace`, `View`, `Window` interaktif menüleri
   - Modern Lux AI monogram logosu (`L*`)
   - Sol panel aç/kapa, ileri/geri geçmiş ve `Ctrl+P` arama/komut paleti
   - Sağ tarafta `Open IDE` butonu, düzen değiştiriciler ve Overview paneli aç/kapa butonu

2. **Sol Kenar Çubuğu (Proje & Sohbet Ağacı):**
   - `+ New Conversation` butonu
   - `Automations` ve `Customizations` bağlantıları
   - Klasör tabanlı proje ağacı (`LUX_ai`, `lux_futures_xl`, vb.)
   - Aktif sohbet kartları, pinleme ve seçenekler
   - Sol altta `Settings` dişli butonu

3. **Merkezi Sohbet & Yüzen Mesaj Kutusu (`surface-composer`):**
   - Antigravity'ye özgü çift çerçeveli kayan mesaj kutusu (`bg-card-border` + `bg-card` 20px radius)
   - Model seçici: `Gemini 3.8 Flash High`, `Gemini 3.8 Pro`, `Claude 3.7 Sonnet`, `GPT-4o`, `Lux Omni 4.0`
   - Mod seçici: `⚡ Turbo`, `Standard`, `🧠 Deep Think`
   - Ses, mikrofon ve dosya ekleme butonları
   - Tıklanabilir ve açılır/kapanır Ajan Araç Adımları (Tool execution step pills)

4. **Sağ Araç Paneli (Overview & Tools):**
   - `Overview`: Çalışma alanı özeti ve hızlı kartlar
   - `Files`: Proje dosyaları ağacı ve dosya düzenleyiciye gönderme
   - `Terminal`: Gerçek PowerShell komutlarını çalıştıran gömülü terminal
   - `Webview`: Canlı `LUX Futures XL` (`http://127.0.0.1:8000/#positions`) göstergesi
   - Alt kısımda `Background Tasks` durumu

5. **Gömülü IDE Modu (`Open IDE`):**
   - Sağ üstteki `Open IDE` butonuna basıldığında ekranı bölerek dosya düzenleyiciyi (kod editörü) açar.
   - Dosyaları okuma ve doğrudan disk üzerine kaydetme desteği.

---

## 🚀 Çalıştırma

Projeyi masaüstünüzden çalıştırmak için:

### Yöntem 1: Çift Tıklama
Klasördeki `start_lux_ai.bat` dosyasına çift tıklayın.

### Yöntem 2: Terminalden
```powershell
cd C:\Users\SERVER\Desktop\LUX_ai
npm start
```

---

## 🧩 Ek Özellikler & Projeye Ekleme Mimarisi

İlerleyen aşamalarda projeye eklenecek tüm özel modüller için modüler bir mimari kurulmuştur:
- **`src/js/rightPanel.js`**: Yeni sağ panel sekmeleri (ör. Trading Bot, Özel İndikatörler, Analizler) eklemek için kullanılır.
- **`src/js/chat.js`**: Yapay zeka ajanının araç çağrıları ve özel API istekleri için kullanılır.
- **`src/js/store.js`**: Veri modelleri, ayarlar ve oturum hafızası için durum yönetimidir.
- **`main.js`**: Electron ana işleminde sistem seviyesinde çalıştırmak istediğiniz Python scriptleri, WebSocket köprüleri veya arka plan servisleri için IPC kanalları tanımlanabilir.
