/**
 * FORJA Service Worker - v29.2.1 PWA cache
 *
 * Estratégia:
 * - Cache-first: HTML, CSS/JS da página, fontes do Google, Chart.js de CDN
 *   (sobrevive offline; invalida por versão no HTML)
 * - Network-only: chamadas ao Apps Script (sempre fresco, nunca servir data antiga)
 * - Fallback: página offline se o shell estiver cacheado
 *
 * v28.9.1: BUGFIX - manifest.json volta a ser arquivo separado (a v28.9.0
 * tinha inlinado ele no HTML via <script type="application/manifest+json">,
 * mas essa tecnica nao e reconhecida pelo Chrome/Android para fins de
 * instalabilidade - o banner "instalar app" parava de aparecer).
 * v28.9.2: RECONFIGURAR URL agora exige chave admin (mudanca so no HTML,
 * bump de versao aqui so pra invalidar o cache antigo do shell).
 * v28.9.3: manifest.json ganhou icone 512x512 (Chrome Android e mais
 * rigoroso que o desktop pra liberar o banner de instalacao).
 * v28.9.4: BUGFIX CRITICO - este arquivo apontava pro nome de arquivo
 * versionado (forja28.9.X.html), que nao existe no servidor. O arquivo
 * real la e sempre "forja.html" (nome fixo). Corrigido - isso causava
 * 404 ao abrir o app pela tela inicial apos instalar.
 * v28.9.5: BUGFIX no HTML (mapa muscular/recuperacao usava parser de data
 * errado pra datas BR digitadas a mao) - bump aqui so pra invalidar o
 * cache antigo do shell.
 * v28.9.6: BUGFIX no HTML (dataLocalIso - raiz do bug de data BR, cobre
 * tambem data digitada na coluna timestamp, nao so data_treino) - bump
 * aqui so pra invalidar o cache antigo do shell.
 * v29.0.0: REDESIGN VISUAL COMPLETO no HTML (tema claro, accent brasa,
 * home nova com cena da forja) + manifest com theme/background claros e
 * icones novos. Bump aqui pra invalidar o shell antigo. Obs: no PWA ja
 * instalado no Android, theme_color/icone podem exigir reinstalar o app
 * (cache de manifest do Chrome).
 * v29.1.0: aliases de exercicio na EVOLUCAO (aba "exercicios" da planilha
 * unifica dropdown/grafico/meta; requer backend v3.6) - bump aqui so pra
 * invalidar o cache antigo do shell.
 * v29.2.0: FEED MOTIVACIONAL na tela de login (cards publicos de quem
 * treinou - streak, campeao do mes, marca semanal; requer backend v3.7
 * com a action feedMotivacional) - bump aqui so pra invalidar o cache
 * antigo do shell. A chamada da action e ao Apps Script, portanto ja e
 * network-only como as demais (nunca cacheada aqui).
 * v29.2.1: TREINAR ganhou a opcao ADICIONAR na trava de sessao existente
 * (mudanca so no HTML) - bump aqui so pra invalidar o cache antigo do shell.
 * v29.3.0: PERFORMANCE no HTML (login em 1 chamada via action "login" do
 * backend v3.8 + TTL 30s anti-double-fetch + stale-while-revalidate do
 * dashboard do aluno em localStorage) - bump aqui so pra invalidar o cache
 * antigo do shell. As chamadas novas continuam sendo ao Apps Script
 * (network-only aqui, nada muda neste arquivo alem da versao).
 * v29.4.0: PERFORMANCE 2 + BUGFIX neste arquivo. (1) O HTML tirou o
 * Chart.js do <head> e carrega sob demanda na EVOLUCAO - a entrada do
 * cdnjs em ASSETS CONTINUA aqui de proposito (o precache e o que faz o
 * load on-demand ser instantaneo e funcionar offline; a URL precisa bater
 * com CHARTJS_URL no HTML). (2) BUGFIX: os catches do fetch handler
 * devolviam ./forja.html pra QUALQUER request que falhasse - um script ou
 * chamada de API offline recebia HTML com status 200 (onerror nao dispara,
 * erro silencioso). Agora so requests de NAVEGACAO caem pro shell; todo o
 * resto recebe 503, que o app trata como erro de verdade.
 * v29.4.1: PERFORMANCE 3 no HTML (ping do rodape atrasado ~2.5s pra nao
 * competir com o feedMotivacional no boot - medido ao vivo que chamadas
 * concorrentes ao Apps Script se atravessam) - bump aqui so pra invalidar
 * o cache antigo do shell. Nada muda neste arquivo alem da versao.
 */

const CACHE_VERSION = 'forja-v29.4.1';
const SHELL_CACHE = CACHE_VERSION + '-shell';
const ASSETS = [
  './',
  './forja.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;600;800&display=swap',
  'https://fonts.gstatic.com',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(cache => {
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(() => console.log('Skip cache:', url)))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names
          .filter(name => name.startsWith('forja-') && name !== SHELL_CACHE)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // v29.4.0: fallback pro shell SO em navegacao. Antes, qualquer request que
  // falhasse (script, fetch de API) recebia o forja.html com status 200 -
  // onerror nao disparava e o erro ficava silencioso/indecifravel no app.
  const offlineFallback = () => (request.mode === 'navigate'
    ? caches.match('./forja.html').then(r => r || new Response('Offline', { status: 503 }))
    : Promise.resolve(new Response('Offline', { status: 503 })));

  // Apps Script (nao cachear nunca — sempre fresco)
  if (url.hostname === 'script.google.com' || url.hostname.includes('script.google')) {
    return e.respondWith(fetch(request).catch(offlineFallback));
  }

  // Tudo o resto: cache-first (fontes, CDN, etc)
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(res => {
      if (!res || res.status !== 200 || res.type === 'error') return res;
      const clone = res.clone();
      caches.open(SHELL_CACHE).then(cache => cache.put(request, clone));
      return res;
    })).catch(offlineFallback)
  );
});
