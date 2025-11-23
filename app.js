// ==========================================
// GEMINI ARCHITECT - GŁÓWNA LOGIKA (MASTERMIND)
// Data: 2025-11-23
// ==========================================

let geminiKey = "";
let githubToken = "";
let repoOwner = "";
let repoName = "";

let chatHistory = [];
let roadmapData = null;

// --- INSTRUKCJA SYSTEMOWA ---
const SYSTEM_INSTRUCTION = `
Jesteś Głównym Architektem i Projektantem Aplikacji (Mastermind). Twoim zadaniem jest obsługa komunikacji w bardzo specyficzny sposób, aby zapewnić najwyższą jakość odpowiedzi technicznych.

ZASADY DZIAŁANIA (Kluczowe):
1. Otrzymujesz wiadomość od użytkownika w języku perskim.
2. Twoim PIERWSZYM zadaniem jest przetłumaczenie tego perskiego promptu na prosty, płynny i w pełni zrozumiały język polski. Ten polski tekst jest Twoim wewnętrznym promptem roboczym.
3. Na podstawie tego polskiego promptu roboczego generuj pełną, merytoryczną odpowiedź w języku polskim, zgodnie z rolą architekta projektu i z uwzględnieniem historii rozmowy.
4. Jeśli użytkownik prosi o plan projektu lub definiujesz kroki, wygeneruj hierarchiczny plan.
5. Twoim OSTATNIM zadaniem jest przetłumaczenie wygenerowanej polskiej odpowiedzi na płynny i profesjonalny język perski.
Twoja ostateczna odpowiedź, którą zwrócisz użytkownikowi, musi być WYŁĄCZNIE w języku perskim (chyba że to kod). 

FORMATOWANIE ODPOWIEDZI:
- Wszelki kod umieszczaj w blokach markdown \`\`\`language ... \`\`\`
- Kod MUSI być w formacie LTR.
- Używaj pogrubień i kursywy dla lepszej czytelności.

ZARZĄDZANIE MAPĄ DROGOWĄ:
Jeśli definiujesz lub aktualizujesz strukturę projektu, na samym końcu odpowiedzi dodaj specjalny blok JSON:
\`\`\`json:roadmap
{
  "root": "Nazwa Projektu",
  "steps": [
    { "id": 1, "title": "Nazwa Etapu", "status": "done/active/pending", "substeps": [...] }
  ]
}
\`\`\`
`;

function initializeSession() {
    geminiKey = document.getElementById('geminiKeyInput').value.trim();
    githubToken = document.getElementById('githubTokenInput').value.trim();
    repoOwner = document.getElementById('repoOwnerInput').value.trim();
    repoName = document.getElementById('repoNameInput').value.trim();

    if (!geminiKey) {
        alert("Klucz Gemini API jest wymagany!");
        return;
    }

    document.getElementById('setupModal').style.display = 'none';
    logToConsole("Inicjalizacja systemu...");
    logToConsole("Połączono z Gemini API.");

    if (githubToken && repoOwner && repoName) {
        logToConsole(`Skonfigurowano repozytorium GitHub: ${repoOwner}/${repoName}`);
    } else {
        logToConsole("Tryb offline (bez GitHub).");
    }
}

function logToConsole(msg) {
    const consoleEl = document.getElementById('githubConsole');
    const time = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    consoleEl.innerHTML += `> [${time}] ${msg}<br>`;
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

// === UI HELPERS ===
const userInput = document.getElementById('userInput');

userInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

userInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// === GŁÓWNA FUNKCJA CZATU ===
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    addMessageToUI('user', text);
    userInput.value = '';
    userInput.style.height = 'auto';

    const loadingId = addLoadingIndicator();

    const contents = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));
    contents.push({ role: 'user', parts: [{ text: text }] });

    try {
        const response = await callGeminiAPI(contents);
        document.getElementById(loadingId)?.remove();

        const { cleanText, roadmapJson } = parseResponse(response);

        if (roadmapJson) {
            roadmapData = roadmapJson;
            updateRoadmapUI(roadmapJson);
        }

        addMessageToUI('model', cleanText);

        chatHistory.push({ role: 'user', content: text });
        chatHistory.push({ role: 'model', content: response });

    } catch (error) {
        document.getElementById(loadingId)?.remove();
        addMessageToUI('model', `**خطای سیستم:** ${error.message}`);
        console.error(error);
    }
}

// === KOMUNIKACJA Z GEMINI ===
async function callGeminiAPI(contents) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

    const payload = {
        contents: contents,
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 8192 }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    return data.candidates[0].content.parts[0].text;
}

// === PARSOWANIE ODPOWIEDZI – najważniejsze! ===
function parseResponse(fullText) {
    // Szukamy bloku json:roadmap
    const roadmapRegex = /```json:roadmap\s*([\s\S]*?)\s*```/;
    const match = fullText.match(roadmapRegex);

    let roadmapJson = null;
    let cleanText = fullText;

    if (match && match[1]) {
        try {
            roadmapJson = JSON.parse(match[1]);
            cleanText = fullText.replace(roadmapRegex, '').trim();
        } catch (e) {
            console.warn("Błąd parsowania JSON roadmapy", e);
        }
    }

    return { cleanText, roadmapJson };
}

// === UI: DODAWANIE WIADOMOŚCI ===
function addMessageToUI(sender, text) {
    const container = document.getElementById('chatContainer');
    const isUser = sender === 'user';

    const bubbleClass = isUser
        ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-2xl rounded-tr-none'
        : 'bg-[#2c2c2e]/80 border border-white/10 rounded-2xl rounded-tl-none';

    const div = document.createElement('div');
    div.className = 'flex gap-4';
    div.innerHTML = `
        <div class="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${isUser ? 'bg-white/20' : 'bg-gradient-to-br from-purple-600 to-blue-500'}">
            ${isUser ? '<i class="fa-solid fa-user text-white"></i>' : '<i class="fa-solid fa-brain text-white"></i>'}
        </div>
        <div class="flex-1 space-y-2">
            <div class="text-xs text-gray-500 font-mono uppercase">${isUser ? 'شما' : 'معمار ارشد'}</div>
            <div class="prose persian-text ${bubbleClass} p-4 max-w-full">
                ${marked.parse(text)}
            </div>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // Highlight.js dla kodu
    div.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    // Przyciski kopiowania
    div.querySelectorAll('pre').forEach(pre => {
        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.textContent = 'کپی';
        btn.onclick = () => {
            navigator.clipboard.writeText(pre.querySelector('code').innerText);
            btn.textContent = 'انجام!';
            setTimeout(() => btn.textContent = 'کپی', 2000);
        };
        pre.appendChild(btn);
    });
}

function addLoadingIndicator() {
    const id = 'loader_' + Date.now();
    const container = document.getElementById('chatContainer');
    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex gap-4';
    div.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 flex-shrink-0"></div>
        <div class="flex-1">
            <div class="text-xs text-gray-500 font-mono uppercase">معمار ارشد</div>
            <div class="typing-indicator p-4">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

// === ROADMAP UI ===
function updateRoadmapUI(data) {
    const container = document.getElementById('roadmapContainer');
    container.innerHTML = '';

    function renderSteps(steps, parentUl) {
        steps.forEach(step => {
            const li = document.createElement('li');
            const statusClass = {
                done: 'status-done',
                active: 'status-active',
                pending: 'status-pending'
            }[step.status || 'pending'];

            li.innerHTML = `
                <div class="tree-item">
                    <span class="status-icon ${statusClass}"></span>
                    <span>${step.title}</span>
                </div>
            `;
            parentUl.appendChild(li);

            if (step.substeps && step.substeps.length > 0) {
                const ul = document.createElement('ul');
                parentUl.appendChild(ul);
                renderSteps(step.substeps, ul);
            }
        });
    }

    const rootTitle = document.createElement('h4');
    rootTitle.className = 'text-lg font-bold text-white mb-4 text-center';
    rootTitle.textContent = data.root || 'پروژه';
    container.appendChild(rootTitle);

    if (data.steps && data.steps.length > 0) {
        const ul = document.createElement('ul');
        container.appendChild(ul);
        renderSteps(data.steps, ul);
    } else {
        container.innerHTML += '<p class="text-gray-600 italic text-center">هیچ مرحله‌ای تعریف نشده</p>';
    }
}

// === DODATKOWE FUNKCJE (pobieranie, czyszczenie itp.) ===
function downloadHistory() {
    const data = JSON.stringify({ chatHistory, roadmapData }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gemini-architect-session.json';
    a.click();
}

function uploadHistory(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            chatHistory = data.chatHistory || [];
            roadmapData = data.roadmapData || null;
            if (roadmapData) updateRoadmapUI(roadmapData);
            alert('تاریخچه با موفقیت بارگذاری شد!');
        } catch (err) {
            alert('فایل نامعتبر است.');
        }
    };
    reader.readAsText(file);
}

function clearChat() {
    if (confirm('آیا مطمئن هستید که می‌خواهید تمام چت را پاک کنید؟')) {
        chatHistory = [];
        roadmapData = null;
        document.getElementById('chatContainer').innerHTML = '';
        document.getElementById('roadmapContainer').innerHTML = '<p class="text-gray-600 italic text-center mt-10">در انتظار تعریف پروژه...</p>';
    }
}

function verifyProject() {
    logToConsole("در حال بررسی پروژه روی GitHub... (در آینده)");
    alert("این قابلیت در نسخه بعدی اضافه خواهد شد!");
}