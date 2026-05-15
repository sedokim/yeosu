const islands = [
    { name: "주행사장 - 돌산 진모지구", lat: 34.714553, lng: 127.754165, emoji: "",  desc: "전라남도 여수시 돌산읍 강남해안로 196" },
    { name: "부행사장 - 개도",          lat: 34.570824, lng: 127.667186, emoji: "", desc: "전라남도 여수시 화정면 개도리" },
    { name: "부행사장 - 금오도",         lat: 34.531632, lng: 127.737768, emoji: "", desc: "여수시 금오도" },
    { name: "부행사장 - 여수세계박람회장",lat: 34.751309, lng: 127.747718, emoji: "", desc: "전라남도 여수시 만덕동 61-100" }
];

const CATEGORIES = [
    { code: 'FD6', name: '식당',   emoji: '🍽️', color: '#f97316' },
    { code: 'CS2', name: '편의점', emoji: '🏪', color: '#22c55e' },
    { code: 'AD5', name: '숙박',   emoji: '🏨', color: '#a855f7' }
];

// 여수시 읍·면·동 (이름 + 중심 좌표 + 검색 반경)
const YEOSU_DONGS = [
    { name: '중앙동',   lat: 34.7418, lng: 127.7365, radius: 1200 },
    { name: '충무동',   lat: 34.7455, lng: 127.7294, radius: 1200 },
    { name: '광림동',   lat: 34.7488, lng: 127.7205, radius: 1200 },
    { name: '서강동',   lat: 34.7537, lng: 127.7108, radius: 1200 },
    { name: '국동',     lat: 34.7469, lng: 127.7453, radius: 1200 },
    { name: '한강동',   lat: 34.7520, lng: 127.7380, radius: 1200 },
    { name: '화장동',   lat: 34.7483, lng: 127.7318, radius: 1200 },
    { name: '여서동',   lat: 34.7345, lng: 127.7210, radius: 1500 },
    { name: '문수동',   lat: 34.7275, lng: 127.7148, radius: 1500 },
    { name: '미평동',   lat: 34.7589, lng: 127.6789, radius: 1500 },
    { name: '봉강동',   lat: 34.7533, lng: 127.7242, radius: 1200 },
    { name: '시전동',   lat: 34.7628, lng: 127.7093, radius: 1500 },
    { name: '웅천동',   lat: 34.7559, lng: 127.7622, radius: 2000 },
    { name: '학동',     lat: 34.7405, lng: 127.7498, radius: 1500 },
    { name: '소호동',   lat: 34.7685, lng: 127.7252, radius: 1500 },
    { name: '둔덕동',   lat: 34.7745, lng: 127.6922, radius: 2000 },
    { name: '만흥동',   lat: 34.7832, lng: 127.6718, radius: 2000 },
    { name: '쌍봉동',   lat: 34.7712, lng: 127.6612, radius: 2000 },
    { name: '여천동',   lat: 34.7937, lng: 127.6522, radius: 2000 },
    { name: '주삼동',   lat: 34.8048, lng: 127.6398, radius: 2000 },
    { name: '삼일동',   lat: 34.8123, lng: 127.6592, radius: 2500 },
    { name: '묘도동',   lat: 34.7255, lng: 127.8035, radius: 2000 },
    { name: '돌산읍',   lat: 34.6754, lng: 127.7512, radius: 5000 },
    { name: '소라면',   lat: 34.8218, lng: 127.6192, radius: 5000 },
    { name: '율촌면',   lat: 34.8435, lng: 127.6521, radius: 5000 },
    { name: '화양면',   lat: 34.7228, lng: 127.5723, radius: 5000 },
    { name: '남면',     lat: 34.5412, lng: 127.7382, radius: 5000 },
    { name: '화정면',   lat: 34.6100, lng: 127.6510, radius: 5000 },
    { name: '삼산면',   lat: 34.1840, lng: 127.2980, radius: 5000 },
];

const map = new kakao.maps.Map(document.getElementById('map'), {
    center: new kakao.maps.LatLng(34.6300, 127.7200),
    level: 10
});

const ps = new kakao.maps.services.Places();

let activeOverlay = null;
let activeBtn = null;
let activeCategory = null;
let activeDongBtn = null;
let clusterer = null;
let categoryPopups = [];
let currentDongSearch = null;
let trafficMarkers = [];
let currentTrafficSearch = null;

// ===== 마커 이미지 =====
function makePulseMarker(color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="1.5" stroke-opacity="0.5">
            <animate attributeName="r" values="11;15;11" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="fill-opacity" values="0.12;0.04;0.12" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="stroke-opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="18" cy="18" r="8" fill="${color}" fill-opacity="0.95" stroke="white" stroke-width="2"/>
    </svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return new kakao.maps.MarkerImage(url, new kakao.maps.Size(36, 36), {
        offset: new kakao.maps.Point(18, 18)
    });
}

function makeIslandMarker() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 28 16 28S32 28 32 16C32 7.163 24.837 0 16 0z"
              fill="#3b82f6" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return new kakao.maps.MarkerImage(url, new kakao.maps.Size(32, 44), {
        offset: new kakao.maps.Point(16, 44)
    });
}

function makeClustererStyles(color) {
    return [
        { width:'42px', height:'42px', background:color, borderRadius:'50%', color:'#fff', textAlign:'center', lineHeight:'42px', fontSize:'13px', fontWeight:'700', border:'3px solid white', boxShadow:`0 0 0 2px ${color},0 2px 8px rgba(0,0,0,0.3)` },
        { width:'50px', height:'50px', background:color, borderRadius:'50%', color:'#fff', textAlign:'center', lineHeight:'50px', fontSize:'14px', fontWeight:'700', border:'3px solid white', boxShadow:`0 0 0 2px ${color},0 2px 8px rgba(0,0,0,0.3)` },
        { width:'60px', height:'60px', background:color, borderRadius:'50%', color:'#fff', textAlign:'center', lineHeight:'60px', fontSize:'16px', fontWeight:'700', border:'3px solid white', boxShadow:`0 0 0 2px ${color},0 2px 8px rgba(0,0,0,0.3)` },
    ];
}

const ISLAND_IMAGE = makeIslandMarker();

// ===== DOM =====
const btnList     = document.getElementById('btn-list');
const catList     = document.getElementById('cat-list');
const dongSection = document.getElementById('dong-section');
const dongList    = document.getElementById('dong-list');
const placeList   = document.getElementById('place-list');
const infoPanel   = document.getElementById('info-panel');
const infoPanelTitle = document.getElementById('info-panel-title');

function closeOverlay() {
    if (activeOverlay) { activeOverlay.setMap(null); activeOverlay = null; }
}

// ===== info-panel 제어 =====
function showInfoPanel(mode, title) {
    infoPanel.style.display = 'flex';
    infoPanelTitle.textContent = title;
    document.getElementById('store-mode').style.display  = mode === 'store'   ? 'flex'  : 'none';
    document.getElementById('traffic-mode').style.display = mode === 'traffic' ? 'block' : 'none';
}

function closeInfoPanel() {
    infoPanel.style.display = 'none';
}

document.getElementById('info-panel-close').addEventListener('click', () => {
    closeInfoPanel();
    clearCategory();
    activeCategory = null;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    dongSection.style.display = 'none';
    setActiveDongBtn(null);
    document.querySelectorAll('.traffic-btn').forEach(b => b.classList.remove('active'));
    activeTrafficBtn = null;
    clearTrafficMarkers();
});

function clearCategory() {
    if (clusterer) { clusterer.clear(); clusterer = null; }
    categoryPopups.forEach(p => p.setMap(null));
    categoryPopups = [];
    placeList.innerHTML = '';
    const ss = document.getElementById('store-search');
    if (ss) { ss.value = ''; ss.disabled = true; }
    closeInfoPanel();
}

function setActiveDongBtn(btn) {
    if (activeDongBtn) activeDongBtn.classList.remove('active');
    activeDongBtn = btn;
    if (btn) btn.classList.add('active');
}

// ===== 동 격자 생성 =====
function generateDongGrid(dong) {
    const step = dong.radius * 0.40;
    const searchR = Math.ceil(dong.radius * 0.48);
    const LAT_PER_M = 1 / 111000;
    const LNG_PER_M = 1 / 92000;
    const results = [];

    for (let dy = -dong.radius; dy <= dong.radius + step * 0.5; dy += step) {
        for (let dx = -dong.radius; dx <= dong.radius + step * 0.5; dx += step) {
            if (Math.sqrt(dy * dy + dx * dx) <= dong.radius * 1.1) {
                results.push({
                    latlng: new kakao.maps.LatLng(
                        dong.lat + dy * LAT_PER_M,
                        dong.lng + dx * LNG_PER_M
                    ),
                    radius: searchR
                });
            }
        }
    }

    return results.length > 0 ? results : [{ latlng: new kakao.maps.LatLng(dong.lat, dong.lng), radius: dong.radius }];
}

// ===== 동 검색 =====
function searchOneCenter(cat, markerImage, center, radius, seenIds) {
    return new Promise(resolve => {
        let settled = false;
        const newMarkers = [];

        ps.categorySearch(cat.code, function(data, status, pagination) {
            if (status !== kakao.maps.services.Status.OK) {
                if (!settled) { settled = true; resolve(newMarkers); }
                return;
            }
            data.forEach(place => {
                if (place.category_group_code !== cat.code) return;
                if (seenIds.has(place.id)) return;
                seenIds.add(place.id);

                const position = new kakao.maps.LatLng(place.y, place.x);
                const marker = new kakao.maps.Marker({ position, title: place.place_name, image: markerImage });

                const popupEl = document.createElement('div');
                popupEl.className = 'custom-overlay';
                popupEl.innerHTML = `
                    <button class="overlay-close" onclick="closeOverlay()">✕</button>
                    <div class="overlay-title">${cat.emoji} ${place.place_name}</div>
                    <div class="overlay-desc">${place.road_address_name || place.address_name}</div>
                    ${place.phone ? `<div class="overlay-desc" style="margin-top:4px">📞 ${place.phone}</div>` : ''}
                `;
                const popupOverlay = new kakao.maps.CustomOverlay({ content: popupEl, map: null, position, yAnchor: 1.3 });
                categoryPopups.push(popupOverlay);

                marker.addListener('click', () => {
                    closeOverlay();
                    popupOverlay.setMap(map);
                    activeOverlay = popupOverlay;
                });

                newMarkers.push(marker);

                const itemEl = document.createElement('div');
                itemEl.className = 'place-item';
                itemEl.textContent = place.place_name;
                itemEl.addEventListener('click', () => {
                    closeOverlay();
                    popupOverlay.setMap(map);
                    activeOverlay = popupOverlay;
                    map.setCenter(position);
                    map.setLevel(4);
                });
                placeList.appendChild(itemEl);
            });

            if (pagination.hasNextPage) {
                pagination.nextPage();
            } else {
                if (!settled) { settled = true; resolve(newMarkers); }
            }
        }, { location: center, radius, size: 15 });
    });
}

async function runDongSearch(cat, dong) {
    const searchId = Symbol();
    currentDongSearch = searchId;

    clearCategory();
    showInfoPanel('store', `${cat.emoji} ${dong.name} ${cat.name}`);
    const ss = document.getElementById('store-search');
    if (ss) { ss.disabled = false; ss.value = ''; }
    const currentCode = cat.code;
    const markerImage = makePulseMarker(cat.color);
    const seenIds = new Set();
    const centers = generateDongGrid(dong);

    clusterer = new kakao.maps.MarkerClusterer({
        map, averageCenter: true, minLevel: 4, disableClickZoom: false,
        styles: makeClustererStyles(cat.color),
        calculator: [10, 100, 1000],
    });

    const titleEl = document.createElement('div');
    titleEl.className = 'place-section-title';
    titleEl.textContent = `${cat.emoji} ${dong.name} ${cat.name} (불러오는 중… 0/${centers.length})`;
    placeList.appendChild(titleEl);

    for (let i = 0; i < centers.length; i++) {
        if (activeCategory !== currentCode || currentDongSearch !== searchId) return;

        const { latlng, radius } = centers[i];
        const newMarkers = await searchOneCenter(cat, markerImage, latlng, radius, seenIds);
        if (activeCategory !== currentCode || currentDongSearch !== searchId) return;

        if (newMarkers.length > 0) clusterer.addMarkers(newMarkers);

        const count = placeList.querySelectorAll('.place-item').length;
        titleEl.textContent = `${cat.emoji} ${dong.name} ${cat.name} (${count}개, ${i + 1}/${centers.length} 구역)`;
    }

    if (currentDongSearch !== searchId) return;

    const center = new kakao.maps.LatLng(dong.lat, dong.lng);
    map.setCenter(center);
    map.setLevel(dong.radius > 3000 ? 8 : 6);

    const total = placeList.querySelectorAll('.place-item').length;
    titleEl.textContent = `${cat.emoji} ${dong.name} ${cat.name} (${total}개)`;
}

// ===== 동 목록 렌더링 =====
function showDongList(cat) {
    dongList.innerHTML = '';
    setActiveDongBtn(null);
    const ds = document.getElementById('dong-search');
    if (ds) ds.value = '';

    YEOSU_DONGS.forEach(dong => {
        const btn = document.createElement('button');
        btn.className = 'dong-btn';
        btn.textContent = dong.name;
        btn.addEventListener('click', () => {
            setActiveDongBtn(btn);
            runDongSearch(cat, dong);
        });
        dongList.appendChild(btn);
    });

    dongSection.style.display = 'block';
}

// ===== 위치 마커 =====
islands.forEach(island => {
    const position = new kakao.maps.LatLng(island.lat, island.lng);
    const marker = new kakao.maps.Marker({ map, position, title: island.name, image: ISLAND_IMAGE });

    const content = document.createElement('div');
    content.className = 'custom-overlay';
    content.innerHTML = `
        <button class="overlay-close" onclick="closeOverlay()">✕</button>
        <div class="overlay-title">${island.emoji} ${island.name}</div>
        <div class="overlay-desc">${island.desc}</div>
    `;
    const overlay = new kakao.maps.CustomOverlay({ content, map: null, position, yAnchor: 1.3 });

    const btn = document.createElement('button');
    btn.className = 'loc-btn';
    btn.innerHTML = `<span>${island.emoji}</span><span>${island.name}</span>`;
    btnList.appendChild(btn);

    function activate() {
        closeOverlay();
        overlay.setMap(map);
        activeOverlay = overlay;
        map.panTo(position);
        if (activeBtn) activeBtn.classList.remove('active');
        activeBtn = btn;
        btn.classList.add('active');
    }

    btn.addEventListener('click', activate);
    kakao.maps.event.addListener(marker, 'click', activate);
});

// ===== 카테고리 버튼 =====
CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'loc-btn cat-btn';
    btn.innerHTML = `<span>${cat.emoji}</span><span>${cat.name}</span>`;
    catList.appendChild(btn);

    btn.addEventListener('click', () => {
        if (activeCategory === cat.code) {
            clearCategory();
            activeCategory = null;
            btn.classList.remove('active');
            dongSection.style.display = 'none';
            setActiveDongBtn(null);
            return;
        }

        clearTrafficMarkers();
        document.querySelectorAll('.traffic-btn').forEach(b => b.classList.remove('active'));
        activeTrafficBtn = null;
        clearCategory();
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        activeCategory = cat.code;
        btn.classList.add('active');
        showDongList(cat);
    });
});

window.addEventListener('resize', () => map.relayout());

// ===== 교통정보 버튼 =====
const TRAFFIC_SECTIONS = [
    { key: 'parking', name: '임시주차장',     emoji: '🅿️', color: '#3b82f6' },
    { key: 'shuttle', name: '셔틀버스 노선',  emoji: '🚌', color: '#22c55e' },
    { key: 'train',   name: '열차시간표',      emoji: '🚄', color: '#ef4444' },
    { key: 'flight',  name: '항공시간표',      emoji: '✈️', color: '#06b6d4' },
    { key: 'bus',     name: '버스시간표',      emoji: '🚍', color: '#f97316' },
];

// query: Kakao Places 검색어 (없으면 lat/lng 폴백 사용)
const TRAFFIC_LOCATIONS = {
    parking: [
        { name: '유람선 선착장 주차장',    query: '여수 돌산 유람선 선착장',      desc: '500면 · 돌산 지역',         lat: 34.7172, lng: 127.7568 },
        { name: '㈜부영 부지',           query: '여수 부영아파트 돌산',          desc: '400면 · 대형버스 주차장',    lat: 34.7059, lng: 127.7632 },
        { name: '국제교육원 주차장',      query: '여수시 국제교육원',            desc: '100면 · 돌산 지역',         lat: 34.7195, lng: 127.7574 },
        { name: '국동 롯데몰 인근',       query: '롯데마트 여수국동점',           desc: '350면 · 돌산대교 방향',     lat: 34.7469, lng: 127.7453 },
        { name: '진남경기장',            query: '여수 진남경기장',               desc: '1,200면 · 돌산대교 방향',   lat: 34.7413, lng: 127.7319 },
        { name: '망마경기장',            query: '여수 망마경기장',               desc: '339면 · 돌산대교 방향',     lat: 34.7395, lng: 127.7268 },
        { name: '이순신공원 주차장',      query: '이순신공원 여수',              desc: '237면 · 돌산대교 방향',     lat: 34.7365, lng: 127.7388 },
        { name: '스카이타워 뒤 (A·B부지)', query: '여수 스카이타워',             desc: '1,700면 · 거북선대교 방향', lat: 34.7502, lng: 127.7454 },
    ],
    shuttle: [
        { name: '진모지구 승하차장',      query: '여수 진모항',                  desc: '모든 노선 공통 종점',              lat: 34.714553, lng: 127.754165 },
        { name: '여수시청 (①번)',        query: '여수시청',                     desc: '①시청노선 기점 · 주말 운행',       lat: 34.7570,   lng: 127.7200   },
        { name: '망마경기장 (②번)',      query: '여수 망마경기장',               desc: '②노선 기점 · 주중 운행',          lat: 34.7395,   lng: 127.7268   },
        { name: '국동임시주차장 (③번)',  query: '롯데마트 여수국동점',           desc: '③국동노선 기점',                  lat: 34.7469,   lng: 127.7453   },
        { name: '여수엑스포역 (④⑥번)',  query: '여수엑스포역',                 desc: '④⑥번 기점',                      lat: 34.7513,   lng: 127.7478   },
        { name: '진남경기장 (⑤번)',      query: '여수 진남경기장',               desc: '⑤번 기점',                        lat: 34.7413,   lng: 127.7319   },
        { name: '여문주차장 (⑦번)',      query: '여수 이순신광장',              desc: '⑦여문지구노선 기점',              lat: 34.7436,   lng: 127.7328   },
        { name: '화산항 (⑩번 개도)',     query: '화산항 여수',                  desc: '⑩개도 섬내 순환 출발점',          lat: 34.5882,   lng: 127.7018   },
        { name: '함구미항 (⑪번 금오도)', query: '함구미항',                     desc: '⑪금오도 섬내 순환 출발점',        lat: 34.5316,   lng: 127.7378   },
    ],
    train: [
        { name: '여수EXPO역', query: '여수엑스포역', desc: 'KTX · SRT · ITX-새마을호 · 무궁화호', lat: 34.7515, lng: 127.7472 },
    ],
    flight: [
        { name: '여수순천공항', query: '여수순천공항', desc: '김포 · 제주 노선 운항', lat: 34.8423, lng: 127.6178 },
    ],
    bus: [
        { name: '여수 종합버스터미널', query: '여수종합버스터미널', desc: '서울 · 광주 · 부산 노선', lat: 34.7609, lng: 127.7158 },
    ],
};

function makeTrafficPinMarker(key, color) {
    let svg, w, h, ox, oy;
    switch (key) {
        case 'parking':
            // 🅿️ 둥근 사각형 배지 + P자
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
                <path d="M2 7Q2 2 7 2L29 2Q34 2 34 7L34 28Q34 33 29 33L21 33L18 43L15 33L7 33Q2 33 2 28Z"
                      fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                <rect x="12" y="9" width="3" height="15" rx="1.5" fill="white"/>
                <path d="M15 9Q22 9 22 14.5Q22 20 15 20"
                      fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            </svg>`;
            [w, h, ox, oy] = [36, 44, 18, 44];
            break;
        case 'shuttle':
            // 🚌 방패(오각형) + 가로줄 3개
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
                <path d="M18 43L3 30L3 7Q3 2 8 2L28 2Q33 2 33 7L33 30Z"
                      fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                <rect x="11" y="11"   width="14" height="2.5" rx="1.2" fill="white"/>
                <rect x="11" y="16.5" width="14" height="2.5" rx="1.2" fill="white"/>
                <rect x="11" y="22"   width="14" height="2.5" rx="1.2" fill="white"/>
            </svg>`;
            [w, h, ox, oy] = [36, 44, 18, 44];
            break;
        case 'train':
            // 🚄 다이아몬드 화살표 + 이중 원(바퀴)
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
                <path d="M18 2L34 15L26 28L18 43L10 28L2 15Z"
                      fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                <circle cx="18" cy="15" r="7"  fill="none" stroke="white" stroke-width="2.5"/>
                <circle cx="18" cy="15" r="3"  fill="white"/>
            </svg>`;
            [w, h, ox, oy] = [36, 44, 18, 44];
            break;
        case 'flight':
            // ✈️ 원형(꼬리 없음) + 비행기 실루엣
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="${color}" stroke="white" stroke-width="2"/>
                <rect x="17"  y="6"  width="2"  height="16" rx="1"   fill="white"/>
                <rect x="8"   y="14" width="20" height="2.5" rx="1.2" fill="white"/>
                <rect x="12"  y="20" width="12" height="2"   rx="1"   fill="white"/>
            </svg>`;
            [w, h, ox, oy] = [36, 36, 18, 18];
            break;
        case 'bus':
            // 🚍 팔각형 핀 + 버스 창문·바퀴
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
                <path d="M18 2L33 10L33 27L24 34L18 43L12 34L3 27L3 10Z"
                      fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                <rect x="10" y="10" width="16" height="11" rx="2"
                      fill="none" stroke="white" stroke-width="2"/>
                <rect x="12" y="12" width="5" height="5" rx="1" fill="white"/>
                <rect x="19" y="12" width="5" height="5" rx="1" fill="white"/>
                <circle cx="13.5" cy="25" r="2.5" fill="white"/>
                <circle cx="22.5" cy="25" r="2.5" fill="white"/>
            </svg>`;
            [w, h, ox, oy] = [36, 44, 18, 44];
            break;
    }
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return new kakao.maps.MarkerImage(url, new kakao.maps.Size(w, h), {
        offset: new kakao.maps.Point(ox, oy)
    });
}

function clearTrafficMarkers() {
    currentTrafficSearch = null;
    trafficMarkers.forEach(m => m.setMap(null));
    trafficMarkers = [];
    closeOverlay();
}

function resolveLocation(loc) {
    return new Promise(resolve => {
        if (!loc.query) { resolve(loc); return; }
        ps.keywordSearch(loc.query, (data, status) => {
            if (status === kakao.maps.services.Status.OK && data.length > 0) {
                resolve({ ...loc, lat: parseFloat(data[0].y), lng: parseFloat(data[0].x) });
            } else {
                resolve(loc);
            }
        }, { size: 1 });
    });
}

async function showTrafficMarkers(sec) {
    const searchId = Symbol();
    currentTrafficSearch = searchId;

    clearTrafficMarkers();
    currentTrafficSearch = searchId; // clearTrafficMarkers가 null로 초기화하므로 재설정

    const locations = TRAFFIC_LOCATIONS[sec.key];
    if (!locations || locations.length === 0) return;

    const resolved = await Promise.all(locations.map(resolveLocation));
    if (currentTrafficSearch !== searchId) return;

    const markerImage = makeTrafficPinMarker(sec.key, sec.color);
    const bounds = new kakao.maps.LatLngBounds();

    resolved.forEach(loc => {
        const position = new kakao.maps.LatLng(loc.lat, loc.lng);
        const marker = new kakao.maps.Marker({ map, position, title: loc.name, image: markerImage });

        const popupEl = document.createElement('div');
        popupEl.className = 'custom-overlay';
        popupEl.innerHTML = `
            <button class="overlay-close" onclick="closeOverlay()">✕</button>
            <div class="overlay-title">${sec.emoji} ${loc.name}</div>
            <div class="overlay-desc">${loc.desc}</div>
        `;
        const popup = new kakao.maps.CustomOverlay({ content: popupEl, map: null, position, yAnchor: 1.3 });

        marker.addListener('click', () => {
            closeOverlay();
            popup.setMap(map);
            activeOverlay = popup;
        });

        trafficMarkers.push(marker);
        bounds.extend(position);
    });

    if (resolved.length === 1) {
        map.setCenter(new kakao.maps.LatLng(resolved[0].lat, resolved[0].lng));
        map.setLevel(5);
    } else {
        map.setBounds(bounds);
    }
}

const trafficBtns = document.getElementById('traffic-btns');
let activeTrafficBtn = null;

TRAFFIC_SECTIONS.forEach(sec => {
    const btn = document.createElement('button');
    btn.className = 'loc-btn traffic-btn';
    btn.innerHTML = `<span>${sec.emoji}</span><span>${sec.name}</span>`;
    trafficBtns.appendChild(btn);

    btn.addEventListener('click', async () => {
        if (activeTrafficBtn === btn && infoPanel.style.display !== 'none' &&
            document.getElementById('traffic-mode').style.display !== 'none') {
            closeInfoPanel();
            activeTrafficBtn.classList.remove('active');
            activeTrafficBtn = null;
            clearTrafficMarkers();
            return;
        }

        // 카테고리 검색 초기화
        clearCategory();
        activeCategory = null;
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        dongSection.style.display = 'none';
        setActiveDongBtn(null);

        if (activeTrafficBtn) activeTrafficBtn.classList.remove('active');
        activeTrafficBtn = btn;
        btn.classList.add('active');

        showInfoPanel('traffic', `${sec.emoji} ${sec.name}`);
        showTrafficMarkers(sec);
        const contentEl = document.getElementById('traffic-content');
        contentEl.innerHTML = '<div style="color:#475569;padding:24px;text-align:center;font-size:0.85rem">불러오는 중…</div>';

        try {
            const resp = await fetch(`/api/traffic/${sec.key}`);
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            contentEl.innerHTML = data.html;
        } catch (e) {
            contentEl.innerHTML = `<div style="color:#ef4444;padding:20px;font-size:0.82rem">오류: ${e.message}</div>`;
        }
    });
});

// ===== 지역 검색 필터 =====
const dongSearch  = document.getElementById('dong-search');
const storeSearch = document.getElementById('store-search');

dongSearch.addEventListener('input', () => {
    const q = dongSearch.value.trim().toLowerCase();
    document.querySelectorAll('.dong-btn').forEach(btn => {
        btn.style.display = (!q || btn.textContent.toLowerCase().includes(q)) ? '' : 'none';
    });
});

storeSearch.addEventListener('input', () => {
    const q = storeSearch.value.trim().toLowerCase();
    placeList.querySelectorAll('.place-item').forEach(item => {
        item.style.display = (!q || item.textContent.toLowerCase().includes(q)) ? '' : 'none';
    });
});

// ===== 내 위치 =====
function isInKorea(lat, lng) {
    return lat >= 33.0 && lat <= 38.9 && lng >= 124.5 && lng <= 132.0;
}

function makeMyLocationMarker() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
        <circle cx="13" cy="13" r="11" fill="#1a73e8" fill-opacity="0.15" stroke="#1a73e8" stroke-width="1" stroke-opacity="0.4">
            <animate attributeName="r" values="8;13;8" dur="2.5s" repeatCount="indefinite"/>
            <animate attributeName="fill-opacity" values="0.15;0.03;0.15" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="13" cy="13" r="6" fill="#1a73e8" stroke="white" stroke-width="2.5"/>
    </svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return new kakao.maps.MarkerImage(url, new kakao.maps.Size(26, 26), {
        offset: new kakao.maps.Point(13, 13)
    });
}

let myLocationMarker = null;

if (navigator.geolocation) {
    const MY_MARKER_IMAGE = makeMyLocationMarker();
    navigator.geolocation.watchPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (!isInKorea(lat, lng)) return;
        const position = new kakao.maps.LatLng(lat, lng);
        if (!myLocationMarker) {
            myLocationMarker = new kakao.maps.Marker({
                map, position, image: MY_MARKER_IMAGE, title: '내 위치', zIndex: 10
            });
        } else {
            myLocationMarker.setPosition(position);
        }
    }, null, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
}

// ===== 모바일 사이드바 토글 =====
const sidebarToggle  = document.getElementById('sidebar-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarEl      = document.getElementById('sidebar');

function openSidebar() {
    sidebarEl.classList.add('open');
    sidebarOverlay.classList.add('visible');
}

function closeSidebar() {
    sidebarEl.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
}

sidebarToggle.addEventListener('click', () => {
    sidebarEl.classList.contains('open') ? closeSidebar() : openSidebar();
});

sidebarOverlay.addEventListener('click', closeSidebar);

// 위치 버튼·교통 버튼 클릭 후 사이드바 자동 닫기
document.getElementById('btn-list').addEventListener('click', closeSidebar);
document.getElementById('traffic-btns').addEventListener('click', closeSidebar);
