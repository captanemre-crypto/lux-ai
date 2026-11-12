// LUX AI — Araç (tool) şemaları
//
// OpenAI-uyumlu function-calling şemaları ve doğrulama kümesi. chat.js'ten
// ayrıştırıldı; klasik script globalinde tanım kazanır, chat.js'ten ÖNCE yüklenir.

const LUX_OPENAI_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "İnternette canlı arama yapar; güncel haber, hava durumu, fiyat, doküman ve web bilgilerini bulur.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Aranacak sorgu (örn: Gaziantep hava durumu, Porsche 911 GT3 özellikleri)" },
          limit: { type: "number", description: "Maksimum sonuç sayısı (varsayılan 6)" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Verilen web sayfasının (URL) metin içeriğini ve bağlantılarını okur.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Okunacak sayfanın adresi (https://...)" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "image_search",
      description: "İnternette gerçek görsel/fotoğraf arar, doğrular, yerel diske indirir ve sohbette gösterir.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Görsel arama sorgusu (örn: Porsche 911 GT3)" },
          count: { type: "number", description: "Kaç görsel indirileceği (1-4)" },
          saveDir: { type: "string", description: "Sadece kullanıcı açıkça klasör adı isterse belirtin; normalde boş bırakın" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "image_generate",
      description: "Sıfırdan yapay zeka görseli, logo, afiş veya tasarım PNG üretir ve sohbette gösterir.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Tasarlanacak görselin ayrıntılı tarifi (İngilizce veya Türkçe)" },
          title: { type: "string", description: "Görsel başlığı" },
          style: { type: "string", description: "Sanat/tasarım stili (örn: cyberpunk neon, minimal flat, photorealistic)" },
          outputPath: { type: "string", description: "Sadece kullanıcı açıkça dosya adı veya yolu isterse belirtin; normalde boş bırakın" }
        },
        required: ["prompt"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "Aktif çalışma alanını ve Masaüstü'ndeki tüm gerçek proje klasörlerini dosya sayılarıyla listeler.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "Çalışma alanı, Masaüstü (Desktop), proje klasörü veya belirtilen dizindeki dosya ve klasörleri listeler.",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string", description: "Hedef klasör yolu (örn: '', 'Desktop', 'lux_al', 'Desktop/proje')" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Belirtilen dosyanın (çalışma alanı veya Masaüstü) içeriğini okur.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Okunacak dosya yolu (örn: package.json, Desktop/not.txt)" }
        },
        required: ["filePath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Dosyalarda metin veya kod ifadesi arar.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Aranacak metin" },
          dirPath: { type: "string", description: "Opsiyonel alt klasör yolu" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Çalışma alanında veya Masaüstü'nde yeni dosya/web tasarımı oluşturur ya da mevcut dosyayı günceller.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Yazılacak dosya yolu (örn: Desktop/site/index.html, src/app.js)" },
          content: { type: "string", description: "Dosyanın tam içeriği" }
        },
        required: ["filePath", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "mkdir",
      description: "Masaüstü veya çalışma alanında yeni klasör oluşturur.",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string", description: "Oluşturulacak klasör yolu (örn: Desktop/yeni-web-projem)" }
        },
        required: ["dirPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "move_path",
      description: "Dosya veya klasörü taşır ya da yeniden adlandırır.",
      parameters: {
        type: "object",
        properties: {
          srcPath: { type: "string", description: "Kaynak dosya/klasör" },
          destPath: { type: "string", description: "Hedef dosya/klasör" }
        },
        required: ["srcPath", "destPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_path",
      description: "Belirtilen dosya veya klasörü siler.",
      parameters: {
        type: "object",
        properties: {
          targetPath: { type: "string", description: "Silinecek dosya veya klasör yolu" }
        },
        required: ["targetPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "PowerShell komutu çalıştırır ve çıktısını döndürür.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Çalıştırılacak PowerShell komutu" },
          cwd: { type: "string", description: "Opsiyonel çalışma klasörü (örn: Desktop/proje)" }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "capture_screen",
      description: "Bilgisayar ekranının görüntüsünü (PNG) alır ve sohbette gösterir.",
      parameters: {
        type: "object",
        properties: {
          outputPath: { type: "string", description: "Sadece kullanıcı açıkça dosya adı veya yolu isterse belirtin; normalde boş bırakın" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pc_control",
      description: "Bilgisayarı kontrol eder: uygulama/klasör/URL açar, pencereleri listeler/odaklar, tuş/metin/fare/ses/pano yönetir.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "open_app",
              "open_url",
              "open_folder",
              "list_windows",
              "focus_window",
              "type_text",
              "send_keys",
              "mouse_click",
              "mouse_move",
              "volume",
              "clipboard_get",
              "clipboard_set",
              "system_info"
            ],
            description: "Bilgisayar kontrol eylemi"
          },
          target: { type: "string", description: "Uygulama adı (notepad/chrome/vscode/calc), URL, dosya/klasör yolu veya pencere başlığı" },
          value: { type: "string", description: "Metin, tuş veya ses modu (up/down/mute)" },
          x: { type: "number", description: "Fare X koordinatı" },
          y: { type: "number", description: "Fare Y koordinatı" }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "play_lullaby",
      description: "Kullanıcı ninni istediğinde yumuşak müzik kutusu ninnisi başlatır ve dinlenebilir ninni kartı oluşturur.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Ninni başlığı" },
          lyrics: { type: "string", description: "Okunacak sıcak ninni sözleri" }
        },
        required: ["lyrics"]
      }
    }
  }
];

const LUX_VALID_TOOL_NAMES = new Set(LUX_OPENAI_TOOLS.map((t) => t.function.name));
