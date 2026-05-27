const islands = [
    { name: "주행사장 - 돌산 진모지구", lat: 34.714553, lng: 127.754165, emoji: "",  desc: "전라남도 여수시 돌산읍 강남해안로 196" },
    { name: "부행사장 - 개도",          lat: 34.570824, lng: 127.667186, emoji: "", desc: "전라남도 여수시 화정면 개도리" },
    { name: "부행사장 - 금오도",         lat: 34.531632, lng: 127.737768, emoji: "", desc: "여수시 금오도" },
    { name: "부행사장 - 여수세계박람회장",lat: 34.751309, lng: 127.747718, emoji: "", desc: "전라남도 여수시 만덕동 61-100" }
];

const CATEGORIES = [
    { code: 'FD6', name: '식당',   emoji: '🍽️', color: '#f97316' },
    { code: 'CE7', name: '카페',   emoji: '☕', color: '#a16207' },
    { code: 'CS2', name: '편의점', emoji: '🏪', color: '#22c55e' },
    { code: 'AD5', name: '숙박',   emoji: '🏨', color: '#a855f7' }
];

const map = new kakao.maps.Map(document.getElementById('map'), {
    center: new kakao.maps.LatLng(34.6300, 127.7200),
    level: 10
});

const ps = new kakao.maps.services.Places();

let activeOverlay        = null;
let activeBtn            = null;
let trafficMarkers       = [];
let currentTrafficSearch = null;

const allPlaces           = { FD6: [], CE7: [], CS2: [], AD5: [] };
let   preloadDone         = false;
const activeCategories    = new Set();
const categoryClusterers  = {};
const categoryPopupsByCat = {};
const categoryMarkersList = {};
const hiddenCategories    = new Set();
let   placePopups         = {};  // place.id → { overlay, position, name, address, lat, lng }
let   placePhotoCache     = {};  // place.id → { photos, reviews, name }
const photoFetchPromises  = new Map(); // place.id → Promise<photos[]>
let   currentPage         = 1;
let   pageSize            = 20;

// ===== 격자 탐색 설정 =====
const GRID_STEP  = 0.005;  // 격자 셀 크기 (~550 m) — 셀당 45개 초과 방지
const MAX_PAGES  = 3;      // 셀당 최대 페이지 (15개 × 3 = 45개)
const LOAD_BATCH = 20;     // 동시 병렬 처리 셀 수

// ===== 여수시 전체 동·읍·면 =====
// 출처: OpenStreetMap Nominatim API 중심 좌표 (nominatim.openstreetmap.org)
//       + 여수시 공식 홈페이지 행정구역 현황 (yeosu.go.kr)
// 행정동 20 + 법정동 11 + 읍 1 + 면 6 = 총 38개
const YEOSU_DISTRICTS = {
    '동': [
        // ── 구 여수시 도심 (127.70–127.76°E) ──
        { name: '국동',   sw: { lat: 34.718, lng: 127.706 }, ne: { lat: 34.742, lng: 127.732 } }, // Nom.(34.730,127.719)
        { name: '동문동', sw: { lat: 34.730, lng: 127.731 }, ne: { lat: 34.754, lng: 127.757 } }, // Nom.(34.742,127.744)
        { name: '한려동', sw: { lat: 34.733, lng: 127.734 }, ne: { lat: 34.757, lng: 127.760 } }, // Nom.(34.745,127.747) EXPO역·오동도
        { name: '중앙동', sw: { lat: 34.726, lng: 127.726 }, ne: { lat: 34.750, lng: 127.752 } }, // Nom.(34.738,127.739) 이순신광장
        { name: '충무동', sw: { lat: 34.731, lng: 127.718 }, ne: { lat: 34.755, lng: 127.744 } }, // Nom.(34.743,127.731) 충무시장
        { name: '광림동', sw: { lat: 34.735, lng: 127.714 }, ne: { lat: 34.759, lng: 127.740 } }, // Nom.(34.747,127.727)
        { name: '서강동', sw: { lat: 34.729, lng: 127.713 }, ne: { lat: 34.753, lng: 127.739 } }, // Nom.(34.741,127.726) 서항·여수항
        { name: '대교동', sw: { lat: 34.725, lng: 127.735 }, ne: { lat: 34.749, lng: 127.761 } }, // 추정(34.737,127.748) 돌산대교 북단
        { name: '월호동', sw: { lat: 34.734, lng: 127.725 }, ne: { lat: 34.758, lng: 127.751 } }, // 추정(34.746,127.738)
        { name: '덕충동', sw: { lat: 34.745, lng: 127.730 }, ne: { lat: 34.769, lng: 127.754 } }, // Nom.(34.757,127.742)
        // ── 경계·북부 (127.69–127.73°E) ──
        { name: '여서동', sw: { lat: 34.735, lng: 127.693 }, ne: { lat: 34.759, lng: 127.719 } }, // Nom.(34.747,127.706)
        { name: '문수동', sw: { lat: 34.750, lng: 127.690 }, ne: { lat: 34.774, lng: 127.716 } }, // 추정(34.762,127.703)
        { name: '미평동', sw: { lat: 34.761, lng: 127.694 }, ne: { lat: 34.785, lng: 127.720 } }, // Nom.(34.773,127.707)
        { name: '둔덕동', sw: { lat: 34.766, lng: 127.683 }, ne: { lat: 34.790, lng: 127.709 } }, // Nom.(34.778,127.696)
        { name: '경호동', sw: { lat: 34.698, lng: 127.706 }, ne: { lat: 34.722, lng: 127.732 } }, // Nom.(34.710,127.719)
        { name: '만흥동', sw: { lat: 34.765, lng: 127.718 }, ne: { lat: 34.789, lng: 127.744 } }, // Nom.(34.777,127.731)
        // ── 구 여천시 (127.64–127.69°E) ──
        { name: '쌍봉동', sw: { lat: 34.752, lng: 127.653 }, ne: { lat: 34.776, lng: 127.679 } }, // Nom.(34.764,127.666) 여수시청
        { name: '시전동', sw: { lat: 34.741, lng: 127.666 }, ne: { lat: 34.765, lng: 127.692 } }, // Nom.(34.753,127.679)
        { name: '여천동', sw: { lat: 34.765, lng: 127.655 }, ne: { lat: 34.789, lng: 127.681 } }, // Nom.(34.777,127.668)
        { name: '주삼동', sw: { lat: 34.779, lng: 127.653 }, ne: { lat: 34.803, lng: 127.679 } }, // Nom.(34.791,127.666)
        { name: '봉계동', sw: { lat: 34.771, lng: 127.668 }, ne: { lat: 34.795, lng: 127.694 } }, // Nom.(34.783,127.681)
        { name: '선원동', sw: { lat: 34.759, lng: 127.643 }, ne: { lat: 34.783, lng: 127.669 } }, // Nom.(34.771,127.656)
        { name: '신기동', sw: { lat: 34.751, lng: 127.665 }, ne: { lat: 34.775, lng: 127.691 } }, // Nom.(34.763,127.678)
        { name: '학동',   sw: { lat: 34.746, lng: 127.654 }, ne: { lat: 34.770, lng: 127.679 } }, // Nom.(34.758,127.667)
        { name: '웅천동', sw: { lat: 34.733, lng: 127.666 }, ne: { lat: 34.757, lng: 127.692 } }, // Nom.(34.745,127.679)
        // ── 동북부·공업지대·동해안 ──
        { name: '만덕동', sw: { lat: 34.768, lng: 127.725 }, ne: { lat: 34.792, lng: 127.751 } }, // Nom.(34.780,127.738)
        { name: '오천동', sw: { lat: 34.785, lng: 127.729 }, ne: { lat: 34.809, lng: 127.755 } }, // Nom.(34.797,127.742)
        { name: '화장동', sw: { lat: 34.777, lng: 127.741 }, ne: { lat: 34.801, lng: 127.767 } }, // 추정(34.789,127.754)
        { name: '삼일동', sw: { lat: 34.812, lng: 127.700 }, ne: { lat: 34.836, lng: 127.726 } }, // Nom.(34.824,127.713) 여수산단
        // ── 남동 해안 ──
        { name: '소호동', sw: { lat: 34.738, lng: 127.771 }, ne: { lat: 34.762, lng: 127.797 } }, // 추정(34.750,127.784) 소호마리나
        // ── 섬 ──
        { name: '묘도동', sw: { lat: 34.858, lng: 127.694 }, ne: { lat: 34.908, lng: 127.744 } }, // Nom.(34.883,127.719) 광양만 섬
    ],
    '읍': [
        { name: '돌산읍', sw: { lat: 34.582, lng: 127.722 }, ne: { lat: 34.728, lng: 127.842 } }, // Nom.(34.638,127.762) 돌산도 전체
    ],
    '면': [
        { name: '화양면', sw: { lat: 34.620, lng: 127.527 }, ne: { lat: 34.770, lng: 127.667 } }, // Nom.(34.695,127.597) 화양반도
        { name: '소라면', sw: { lat: 34.710, lng: 127.535 }, ne: { lat: 34.856, lng: 127.681 } }, // Nom.(34.783,127.608) 내륙 북서
        { name: '율촌면', sw: { lat: 34.786, lng: 127.509 }, ne: { lat: 34.912, lng: 127.635 } }, // Nom.(34.849,127.572) 율촌산단
        { name: '화정면', sw: { lat: 34.530, lng: 127.515 }, ne: { lat: 34.702, lng: 127.687 } }, // Nom.(34.616,127.601) 개도·여자도 서부 섬
        { name: '남면',   sw: { lat: 34.454, lng: 127.680 }, ne: { lat: 34.594, lng: 127.834 } }, // Nom.(34.524,127.757) 금오도·안도
        { name: '삼산면', sw: { lat: 33.920, lng: 127.110 }, ne: { lat: 34.296, lng: 127.496 } }, // Nom.(34.108,127.303) 거문도·초도·손죽도 (원거리 섬)
    ],
};

const selectedCats    = new Set();  // 탐색할 카테고리
const selectedRegions = new Set();  // 탐색할 지역 이름
let   lastSearchedCats = new Set(); // 마지막으로 탐색한 카테고리 (비활성화 판정용)

// ===== 유틸 =====
function isMobile() { return window.innerWidth <= 1023; }
function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
}
function extractDong(address) {
    if (!address) return '';
    const m = address.match(/여수시\s+(\S+(?:동|읍|면))/);
    return m ? m[1] : '';
}
function updateSidebarSearchBtn() {
    const btn = document.getElementById('sidebar-search-btn');
    if (!btn) return;
    const canSearch = selectedCats.size > 0 && !setsEqual(selectedCats, lastSearchedCats);
    const canClear  = selectedCats.size === 0 && activeCategories.size > 0;
    btn.disabled = !canSearch && !canClear;
}

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
    return new kakao.maps.MarkerImage(url, new kakao.maps.Size(36, 36), { offset: new kakao.maps.Point(18, 18) });
}

function makeIslandMarker() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 28 16 28S32 28 32 16C32 7.163 24.837 0 16 0z"
              fill="#3b82f6" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return new kakao.maps.MarkerImage(url, new kakao.maps.Size(32, 44), { offset: new kakao.maps.Point(16, 44) });
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
const btnList        = document.getElementById('btn-list');
const catList        = document.getElementById('cat-list');
const placeList      = document.getElementById('place-list');
const infoPanel      = document.getElementById('info-panel');
const infoPanelTitle = document.getElementById('info-panel-title');

function closeOverlay() {
    if (activeOverlay) { activeOverlay.setMap(null); activeOverlay = null; }
}

function isInfoPanelOpen() {
    return isMobile() ? infoPanel.style.display !== 'none' : infoPanel.classList.contains('is-open');
}

function showInfoPanel(mode, title) {
    if (isMobile()) {
        infoPanel.style.display = 'flex';
    } else {
        infoPanel.classList.add('is-open');
    }
    infoPanelTitle.textContent = title;
    document.getElementById('store-mode').style.display = 'flex';
    updateResultsToggleBtn();
}

function closeInfoPanel() {
    if (isMobile()) {
        infoPanel.style.display = 'none';
    } else {
        infoPanel.classList.remove('is-open');
    }
    updateResultsToggleBtn();
}

function updateResultsToggleBtn() {
    const btn = document.getElementById('results-toggle-btn');
    if (!btn) return;
    if (activeCategories.size === 0) {
        btn.style.display = 'none';
        btn.classList.remove('active');
        return;
    }
    btn.style.display = 'flex';
    btn.classList.toggle('active', isInfoPanelOpen());
}

function updateCategoryPanelTitle() {
    const cats = CATEGORIES.filter(c => activeCategories.has(c.code));
    const catLabel = cats.map(c => `${c.emoji} ${c.name}`).join(' · ');
    const regionLabel = selectedRegions.size <= 3
        ? [...selectedRegions].join('·')
        : `${selectedRegions.size}개 지역`;
    const total = cats.reduce((sum, c) => sum + (allPlaces[c.code]?.length || 0), 0);
    infoPanelTitle.textContent = `${regionLabel} ${catLabel} (${total}개)`;
}

function clearOneCategory(catCode) {
    if (categoryClusterers[catCode])  { categoryClusterers[catCode].clear(); delete categoryClusterers[catCode]; }
    if (categoryPopupsByCat[catCode]) { categoryPopupsByCat[catCode].forEach(p => p.setMap(null)); delete categoryPopupsByCat[catCode]; }
    delete categoryMarkersList[catCode];
    hiddenCategories.delete(catCode);
}

function clearAllCategories() {
    [...activeCategories].forEach(code => clearOneCategory(code));
    activeCategories.clear();
    placePopups = {};
    placePhotoCache = {};
    photoFetchPromises.clear();
    currentPage = 1;
    placeList.innerHTML = '';
    document.getElementById('pagination').innerHTML = '';
    const ss = document.getElementById('store-search');
    if (ss) { ss.value = ''; ss.disabled = true; }
    const pss = document.getElementById('page-size-select');
    if (pss) pss.disabled = true;
    closeInfoPanel();
    updateResultsToggleBtn();
}

// ===== 격자 셀 단일 카테고리 검색 (페이지 순차 처리) =====
// rect 형식: "minLng,minLat,maxLng,maxLat"
function searchCellAllPages(catCode, swLat, swLng, neLat, neLng, seenIds) {
    return new Promise(resolve => {
        const places  = [];
        const rectStr = `${swLng},${swLat},${neLng},${neLat}`;

        function fetchPage(page) {
            ps.categorySearch(catCode, (data, status, pagination) => {
                if (status === kakao.maps.services.Status.OK) {
                    data.forEach(place => {
                        if (seenIds.has(place.id)) return;
                        seenIds.add(place.id);
                        places.push({
                            id:                place.id,
                            place_name:        place.place_name,
                            road_address_name: place.road_address_name,
                            address_name:      place.address_name,
                            phone:             place.phone,
                            lat:               parseFloat(place.y),
                            lng:               parseFloat(place.x)
                        });
                    });
                    // 다음 페이지가 있고 MAX_PAGES 미만이면 계속 탐색
                    if (pagination.hasNextPage && page < MAX_PAGES) {
                        fetchPage(page + 1);
                    } else {
                        resolve(places);
                    }
                } else {
                    resolve(places); // ZERO_RESULT 또는 오류 → 빈 배열
                }
            }, { rect: rectStr, size: 15, page });
        }

        fetchPage(1);
    });
}

// ===== 선택 지역들의 셀 병합 (중복 제거) =====
function buildMergedCells(regions) {
    const cellMap = new Map();
    for (const d of regions) {
        for (let lat = d.ne.lat; lat > d.sw.lat - GRID_STEP / 2; lat -= GRID_STEP) {
            for (let lng = d.sw.lng; lng < d.ne.lng + GRID_STEP / 2; lng += GRID_STEP) {
                const swLat = parseFloat((lat - GRID_STEP).toFixed(6));
                const neLat = parseFloat(lat.toFixed(6));
                const swLng = parseFloat(lng.toFixed(6));
                const neLng = parseFloat((lng + GRID_STEP).toFixed(6));
                cellMap.set(`${swLat},${swLng}`, { swLat, swLng, neLat, neLng });
            }
        }
    }
    return [...cellMap.values()];
}

// ===== 카테고리 × 셀 배열 탐색 =====
async function gridSearchCells(cat, cells, onProgress) {
    const seenIds = new Set();
    const total   = cells.length;
    let   done    = 0;

    for (let i = 0; i < total; i += LOAD_BATCH) {
        const batch = cells.slice(i, i + LOAD_BATCH);
        await Promise.all(batch.map(async cell => {
            const places = await searchCellAllPages(cat.code, cell.swLat, cell.swLng, cell.neLat, cell.neLng, seenIds);
            allPlaces[cat.code].push(...places);
            done++;
            if (onProgress) onProgress(done);
        }));
    }
}

// ===== 탐색 실행 =====
async function startSearch() {
    const cats    = CATEGORIES.filter(c => selectedCats.has(c.code));
    const regions = Object.values(YEOSU_DISTRICTS).flat().filter(d => selectedRegions.has(d.name));
    if (!cats.length || !regions.length) return;
    const searchedCatCodes = new Set(cats.map(c => c.code));

    // 이전 결과 초기화
    clearAllCategories();
    allPlaces.FD6 = []; allPlaces.CE7 = []; allPlaces.CS2 = []; allPlaces.AD5 = [];
    preloadDone = false;
    document.querySelectorAll('.cat-btn').forEach(b => {
        const cat = CATEGORIES.find(c => c.code === b.dataset.code);
        if (cat) b.innerHTML = `<span>${cat.emoji}</span><span>${cat.name}</span>`;
    });

    const cells   = buildMergedCells(regions);
    const overlay = document.getElementById('loading-overlay');
    const msgEl   = document.getElementById('loading-msg');
    const subEl   = document.getElementById('loading-sub');
    const barEl   = document.getElementById('loading-bar');

    overlay.style.display = 'flex';
    barEl.style.width      = '0%';
    msgEl.textContent      = `탐색 중… ${regions.map(r => r.name).join('·')} (${cells.length}셀)`;
    subEl.textContent      = cats.map(c => `${c.emoji}${c.name} 0`).join(' · ');

    const cellDone = {};
    cats.forEach(c => { cellDone[c.code] = 0; });

    const uiInterval = setInterval(() => {
        subEl.textContent = cats.map(c => `${c.emoji}${c.name} ${allPlaces[c.code].length}`).join(' · ');
        const done  = cats.reduce((s, c) => s + cellDone[c.code], 0);
        barEl.style.width = `${Math.min(95, Math.round(done / (cells.length * cats.length) * 100))}%`;
    }, 300);

    await Promise.all(cats.map(cat =>
        gridSearchCells(cat, cells, done => { cellDone[cat.code] = done; })
    ));

    clearInterval(uiInterval);
    preloadDone = true;
    barEl.style.width = '100%';
    subEl.textContent = `완료 — ${cats.map(c => `${c.emoji}${c.name} ${allPlaces[c.code].length}`).join(' · ')}`;

    document.querySelectorAll('.cat-btn').forEach(b => {
        const cat = CATEGORIES.find(c => c.code === b.dataset.code);
        if (cat && selectedCats.has(cat.code))
            b.innerHTML = `<span>${cat.emoji}</span><span>${cat.name} (${allPlaces[cat.code].length})</span>`;
    });

    setTimeout(() => {
        overlay.style.display = 'none';
        closeRegionPanel();
        closeSidebar();
        lastSearchedCats = searchedCatCodes;
        updateSidebarSearchBtn();
        updateResultsToggleBtn();
        cats.forEach(cat => {
            activeCategories.add(cat.code);
            addCategoryToDisplay(cat);
        });
        const ss = document.getElementById('store-search');
        if (ss) ss.disabled = false;
        const pss = document.getElementById('page-size-select');
        if (pss) pss.disabled = false;
        currentPage = 1;
        showInfoPanel('store', '');
        updateCategoryPanelTitle();
        renderPlaceList();
    }, 400);
}

// ===== 카테고리 표시 =====
function addCategoryToDisplay(cat) {
    const places      = allPlaces[cat.code] || [];
    const markerImage = makePulseMarker(cat.color);

    categoryClusterers[cat.code] = new kakao.maps.MarkerClusterer({
        map, averageCenter: true, minLevel: 4, disableClickZoom: false,
        styles: makeClustererStyles(cat.color), calculator: [10, 100, 1000],
    });
    categoryPopupsByCat[cat.code] = [];

    const markers = [];
    places.forEach(place => {
        const position = new kakao.maps.LatLng(place.lat, place.lng);
        const marker   = new kakao.maps.Marker({ position, title: place.place_name, image: markerImage });

        const popupEl = document.createElement('div');
        popupEl.className = 'custom-overlay';
        popupEl.innerHTML = `
            <div class="overlay-photo-wrap" id="photo-${place.id}"></div>
            <button class="overlay-close" onclick="closeOverlay()">✕</button>
            <div class="overlay-title">${cat.emoji} ${place.place_name}</div>
            <div class="overlay-desc">${place.road_address_name || place.address_name}</div>
            ${place.phone ? `<div class="overlay-phone">📞 ${place.phone}</div>` : ''}
        `;
        const popupOverlay = new kakao.maps.CustomOverlay({ content: popupEl, map: null, position, yAnchor: 1.04, zIndex: 100 });
        categoryPopupsByCat[cat.code].push(popupOverlay);
        placePopups[place.id] = { overlay: popupOverlay, position, name: place.place_name, address: place.road_address_name || place.address_name, lat: place.lat, lng: place.lng };
        marker.addListener('click', () => { showPlacePopup(place.id); });
        markers.push(marker);
    });

    categoryMarkersList[cat.code] = markers;
    if (markers.length > 0) categoryClusterers[cat.code].addMarkers(markers);

    // 첫 30개 사진 백그라운드 preload (batch 4개씩)
    (async () => {
        const ids = places.slice(0, 30).map(p => p.id);
        for (let i = 0; i < ids.length; i += 4) {
            await Promise.all(ids.slice(i, i + 4).map(id => fetchPhoto(id)));
        }
    })();
}

function showPlacePopup(placeId) {
    const popup = placePopups[placeId];
    if (!popup) return;
    closeOverlay();
    popup.overlay.setMap(map);
    activeOverlay = popup.overlay;
    loadPlacePhoto(placeId);
}

function fetchPhoto(placeId) {
    if (photoFetchPromises.has(placeId)) return photoFetchPromises.get(placeId);
    const p = (async () => {
        for (let i = 0; i <= 5; i++) {
            try {
                const resp = await fetch(`/api/place/${placeId}`);
                const data = await resp.json();
                if (data.photos?.length) {
                    const info = placePopups[placeId];
                    placePhotoCache[placeId] = {
                        photos: data.photos.map(u => ({ url: u })),
                        reviews: [],
                        name: info?.name || ''
                    };
                    return placePhotoCache[placeId].photos;
                }
            } catch {}
            if (i < 5) await new Promise(r => setTimeout(r, 500));
        }
        return [];
    })();
    photoFetchPromises.set(placeId, p);
    return p;
}

function applyPhoto(wrap, placeId, photoUrl) {
    wrap.classList.add('loaded');
    wrap.innerHTML = `
        <img class="overlay-photo" src="${photoUrl}" alt="사진">
        <button class="overlay-more-btn" onclick="openPlaceDetail('${placeId}')">›</button>
    `;
}

function applyNoPhoto(wrap) {
    wrap.classList.add('loaded');
    wrap.innerHTML = '<div class="overlay-no-photo">사진이 없습니다.</div>';
}

async function loadPlacePhoto(placeId) {
    const wrap = document.getElementById(`photo-${placeId}`);
    if (!wrap || wrap.classList.contains('loaded')) return;

    if (placePhotoCache[placeId]?.photos?.length) {
        applyPhoto(wrap, placeId, placePhotoCache[placeId].photos[0].url);
        return;
    }

    const photos = await fetchPhoto(placeId);

    // await 사이 DOM 재삽입 대비 재조회
    const cur = document.getElementById(`photo-${placeId}`);
    if (!cur || cur.classList.contains('loaded')) return;
    if (photos.length) applyPhoto(cur, placeId, photos[0].url);
    else applyNoPhoto(cur);
}

function openPlaceDetail(placeId) {
    const cache = placePhotoCache[placeId];
    if (!cache) return;

    document.getElementById('place-detail-title').textContent = cache.name;

    const photosHtml = cache.photos.length > 0
        ? `<div class="detail-photos-grid">${cache.photos.slice(0, 12).map(p =>
            `<img class="detail-photo" src="${p.orgurl || p.url}" alt="사진" loading="lazy">`
          ).join('')}</div>`
        : `<div class="detail-no-content">등록된 사진이 없습니다</div>`;

    const reviewsHtml = cache.reviews.length > 0
        ? cache.reviews.map(r => `
            <div class="detail-review">
                <div class="detail-review-text">${r.contents || ''}</div>
                <div class="detail-review-meta">${r.username || r.userName || ''} ${r.date || r.createTime || ''}</div>
            </div>`).join('')
        : `<div class="detail-no-content">등록된 리뷰가 없습니다</div>`;

    document.getElementById('place-detail-content').innerHTML = `
        ${photosHtml}
        <div class="detail-section-title">리뷰</div>
        ${reviewsHtml}
    `;
    document.getElementById('place-detail-modal').classList.add('open');
}

function closeDetailModal() {
    document.getElementById('place-detail-modal').classList.remove('open');
}

// ===== 페이지네이션 렌더 =====
function renderPagination(totalPages) {
    const el = document.getElementById('pagination');
    el.innerHTML = '';
    if (totalPages <= 1) return;

    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.textContent = '‹';
    prev.disabled = currentPage === 1;
    prev.addEventListener('click', () => { currentPage--; renderPlaceList(); });
    el.appendChild(prev);

    const range = [1];
    for (let i = Math.max(2, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) range.push(i);
    if (totalPages > 1) range.push(totalPages);

    let prevNum = 0;
    range.forEach(num => {
        if (num - prevNum > 1) {
            const dots = document.createElement('span');
            dots.className = 'page-dots';
            dots.textContent = '…';
            el.appendChild(dots);
        }
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (num === currentPage ? ' active' : '');
        btn.textContent = num;
        btn.addEventListener('click', () => { currentPage = num; renderPlaceList(); });
        el.appendChild(btn);
        prevNum = num;
    });

    const next = document.createElement('button');
    next.className = 'page-btn';
    next.textContent = '›';
    next.disabled = currentPage === totalPages;
    next.addEventListener('click', () => { currentPage++; renderPlaceList(); });
    el.appendChild(next);
}

// ===== 통합 목록 렌더 =====
function renderPlaceList() {
    const q = document.getElementById('store-search').value.trim();

    const all = [];
    [...activeCategories].forEach(code => {
        const cat = CATEGORIES.find(c => c.code === code);
        (allPlaces[code] || []).forEach(p => all.push({ ...p, cat }));
    });

    const filtered = q ? all.filter(p => p.place_name.includes(q)) : all;
    const total     = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > totalPages) currentPage = 1;

    const start     = (currentPage - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    placeList.innerHTML = '';
    pageItems.forEach(place => {
        const itemEl = document.createElement('div');
        itemEl.className = 'place-item';
        itemEl.innerHTML = `<span style="margin-right:4px">${place.cat.emoji}</span>${place.place_name}`;
        itemEl.addEventListener('click', () => {
            const p = placePopups[place.id];
            showPlacePopup(place.id);
            if (p) {
                map.setCenter(p.position);
                map.setLevel(3);
                if (isMobile()) closeInfoPanel();
            }
        });
        placeList.appendChild(itemEl);
    });

    renderPagination(totalPages);
}

// ===== 위치 마커 =====
islands.forEach(island => {
    const position = new kakao.maps.LatLng(island.lat, island.lng);
    const marker   = new kakao.maps.Marker({ map, position, title: island.name, image: ISLAND_IMAGE });
    const content  = document.createElement('div');
    content.className = 'custom-overlay';
    content.innerHTML = `
        <button class="overlay-close" onclick="closeOverlay()">✕</button>
        <div class="overlay-title">${island.emoji} ${island.name}</div>
        <div class="overlay-desc">${island.desc}</div>
    `;
    const overlay = new kakao.maps.CustomOverlay({ content, map: null, position, yAnchor: 1.1, zIndex: 100 });
    const btn = document.createElement('button');
    btn.className = 'loc-btn';
    btn.innerHTML = `<span>${island.emoji}</span><span>${island.name}</span>`;
    btnList.appendChild(btn);
    function activate() {
        closeOverlay(); overlay.setMap(map); activeOverlay = overlay; map.panTo(position);
        if (activeBtn) activeBtn.classList.remove('active'); activeBtn = btn; btn.classList.add('active');
    }
    btn.addEventListener('click', activate);
    kakao.maps.event.addListener(marker, 'click', activate);
});

// ===== 카테고리 버튼 (다중 선택 → 지역 패널 연동) =====
const regionPanel = document.getElementById('region-panel');

CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className    = 'loc-btn cat-btn';
    btn.dataset.code = cat.code;
    btn.innerHTML    = `<span>${cat.emoji}</span><span>${cat.name}</span>`;
    catList.appendChild(btn);

    btn.addEventListener('click', () => {
        // 이미 탐색된 카테고리: 선택/해제 + 마커 표시/숨김 연동
        if (activeCategories.has(cat.code)) {
            const cl = categoryClusterers[cat.code];
            const ms = categoryMarkersList[cat.code] || [];
            if (selectedCats.has(cat.code)) {
                selectedCats.delete(cat.code);
                btn.classList.remove('active');
                hiddenCategories.add(cat.code);
                if (cl) cl.clear();
            } else {
                selectedCats.add(cat.code);
                btn.classList.add('active');
                hiddenCategories.delete(cat.code);
                if (cl) cl.addMarkers(ms);
            }
            updateSidebarSearchBtn();
            return;
        }

        // 탐색 전 선택/해제
        if (selectedCats.has(cat.code)) {
            selectedCats.delete(cat.code);
            btn.classList.remove('active');
        } else {
            clearTrafficMarkers();
            document.querySelectorAll('.traffic-menu-btn').forEach(b => b.classList.remove('active'));
            activeTrafficBtn = null;
            selectedCats.add(cat.code);
            btn.classList.add('active');
        }
        if (selectedCats.size === 0) {
            closeRegionPanel();
            selectedRegions.clear();
            regionPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        }
        updateSearchBtnState();
        updateSidebarSearchBtn();
    });
});

document.getElementById('info-panel-close').addEventListener('click', () => {
    closeInfoPanel();
    lastSearchedCats = new Set();
    updateSidebarSearchBtn();
});

window.addEventListener('resize', () => map.relayout());

// ===== 교통정보 =====
const TRAFFIC_SECTIONS = [
    { key: 'parking', name: '임시주차장',    emoji: '🅿️', color: '#3b82f6' },
    { key: 'shuttle', name: '셔틀버스 노선', emoji: '🚌', color: '#22c55e' },
    { key: 'train',   name: '열차시간표',     emoji: '🚄', color: '#ef4444' },
    { key: 'flight',  name: '항공시간표',     emoji: '✈️', color: '#06b6d4' },
    { key: 'bus',     name: '버스시간표',     emoji: '🚍', color: '#f97316' },
];

const TRAFFIC_LOCATIONS = {
    parking: [
        { name: '유람선 선착장 주차장',     query: '여수 돌산 유람선 선착장',   desc: '500면 · 돌산 지역',         lat: 34.7172, lng: 127.7568 },
        { name: '㈜부영 부지',            query: '여수 부영아파트 돌산',       desc: '400면 · 대형버스 주차장',    lat: 34.7059, lng: 127.7632 },
        { name: '국제교육원 주차장',       query: '여수시 국제교육원',          desc: '100면 · 돌산 지역',         lat: 34.7195, lng: 127.7574 },
        { name: '국동 롯데몰 인근',        query: '롯데마트 여수국동점',        desc: '350면 · 돌산대교 방향',     lat: 34.7469, lng: 127.7453 },
        { name: '진남경기장',             query: '여수 진남경기장',            desc: '1,200면 · 돌산대교 방향',   lat: 34.7413, lng: 127.7319 },
        { name: '망마경기장',             query: '여수 망마경기장',            desc: '339면 · 돌산대교 방향',     lat: 34.7395, lng: 127.7268 },
        { name: '이순신공원 주차장',       query: '이순신공원 여수',            desc: '237면 · 돌산대교 방향',     lat: 34.7365, lng: 127.7388 },
        { name: '스카이타워 뒤 (A·B부지)', query: '여수 스카이타워',           desc: '1,700면 · 거북선대교 방향', lat: 34.7502, lng: 127.7454 },
    ],
    shuttle: [
        { name: '진모지구 승하차장',       query: '여수 진모항',               desc: '모든 노선 공통 종점',        lat: 34.714553, lng: 127.754165 },
        { name: '여수시청 (①번)',         query: '여수시청',                  desc: '①시청노선 기점 · 주말 운행', lat: 34.7570,   lng: 127.7200   },
        { name: '망마경기장 (②번)',       query: '여수 망마경기장',            desc: '②노선 기점 · 주중 운행',    lat: 34.7395,   lng: 127.7268   },
        { name: '국동임시주차장 (③번)',   query: '롯데마트 여수국동점',        desc: '③국동노선 기점',            lat: 34.7469,   lng: 127.7453   },
        { name: '여수엑스포역 (④⑥번)',   query: '여수엑스포역',              desc: '④⑥번 기점',                lat: 34.7513,   lng: 127.7478   },
        { name: '진남경기장 (⑤번)',       query: '여수 진남경기장',            desc: '⑤번 기점',                  lat: 34.7413,   lng: 127.7319   },
        { name: '여문주차장 (⑦번)',       query: '여수 이순신광장',            desc: '⑦여문지구노선 기점',        lat: 34.7436,   lng: 127.7328   },
        { name: '화산항 (⑩번 개도)',      query: '화산항 여수',               desc: '⑩개도 섬내 순환 출발점',    lat: 34.5882,   lng: 127.7018   },
        { name: '함구미항 (⑪번 금오도)',  query: '함구미항',                  desc: '⑪금오도 섬내 순환 출발점',  lat: 34.5316,   lng: 127.7378   },
    ],
    train:  [{ name: '여수EXPO역',        query: '여수엑스포역',        desc: 'KTX · SRT · ITX-새마을호 · 무궁화호', lat: 34.7515, lng: 127.7472 }],
    flight: [{ name: '여수순천공항',      query: '여수순천공항',        desc: '김포 · 제주 노선 운항',              lat: 34.8423, lng: 127.6178 }],
    bus:    [{ name: '여수 종합버스터미널', query: '여수종합버스터미널', desc: '서울 · 광주 · 부산 노선',            lat: 34.7609, lng: 127.7158 }],
};

function makeTrafficPinMarker(key, color) {
    let svg, w, h, ox, oy;
    switch (key) {
        case 'parking':
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
                <path d="M2 7Q2 2 7 2L29 2Q34 2 34 7L34 28Q34 33 29 33L21 33L18 43L15 33L7 33Q2 33 2 28Z"
                      fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                <rect x="12" y="9" width="3" height="15" rx="1.5" fill="white"/>
                <path d="M15 9Q22 9 22 14.5Q22 20 15 20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            </svg>`; [w, h, ox, oy] = [36, 44, 18, 44]; break;
        case 'shuttle':
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
                <path d="M18 43L3 30L3 7Q3 2 8 2L28 2Q33 2 33 7L33 30Z"
                      fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                <rect x="11" y="11"   width="14" height="2.5" rx="1.2" fill="white"/>
                <rect x="11" y="16.5" width="14" height="2.5" rx="1.2" fill="white"/>
                <rect x="11" y="22"   width="14" height="2.5" rx="1.2" fill="white"/>
            </svg>`; [w, h, ox, oy] = [36, 44, 18, 44]; break;
        case 'train':
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
                <path d="M18 2L34 15L26 28L18 43L10 28L2 15Z"
                      fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                <circle cx="18" cy="15" r="7" fill="none" stroke="white" stroke-width="2.5"/>
                <circle cx="18" cy="15" r="3" fill="white"/>
            </svg>`; [w, h, ox, oy] = [36, 44, 18, 44]; break;
        case 'flight':
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="${color}" stroke="white" stroke-width="2"/>
                <rect x="17" y="6"  width="2"  height="16" rx="1"   fill="white"/>
                <rect x="8"  y="14" width="20" height="2.5" rx="1.2" fill="white"/>
                <rect x="12" y="20" width="12" height="2"   rx="1"   fill="white"/>
            </svg>`; [w, h, ox, oy] = [36, 36, 18, 18]; break;
        case 'bus':
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
                <path d="M18 2L33 10L33 27L24 34L18 43L12 34L3 27L3 10Z"
                      fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                <rect x="10" y="10" width="16" height="11" rx="2" fill="none" stroke="white" stroke-width="2"/>
                <rect x="12" y="12" width="5" height="5" rx="1" fill="white"/>
                <rect x="19" y="12" width="5" height="5" rx="1" fill="white"/>
                <circle cx="13.5" cy="25" r="2.5" fill="white"/>
                <circle cx="22.5" cy="25" r="2.5" fill="white"/>
            </svg>`; [w, h, ox, oy] = [36, 44, 18, 44]; break;
    }
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return new kakao.maps.MarkerImage(url, new kakao.maps.Size(w, h), { offset: new kakao.maps.Point(ox, oy) });
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
            resolve(status === kakao.maps.services.Status.OK && data.length > 0
                ? { ...loc, lat: parseFloat(data[0].y), lng: parseFloat(data[0].x) }
                : loc);
        }, { size: 1 });
    });
}

async function showTrafficMarkers(sec) {
    const searchId = Symbol();
    currentTrafficSearch = searchId;
    clearTrafficMarkers();
    currentTrafficSearch = searchId;
    const locations = TRAFFIC_LOCATIONS[sec.key];
    if (!locations?.length) return;
    const resolved = await Promise.all(locations.map(resolveLocation));
    if (currentTrafficSearch !== searchId) return;
    const markerImage = makeTrafficPinMarker(sec.key, sec.color);
    const bounds      = new kakao.maps.LatLngBounds();
    resolved.forEach(loc => {
        const position = new kakao.maps.LatLng(loc.lat, loc.lng);
        const marker   = new kakao.maps.Marker({ map, position, title: loc.name, image: markerImage });
        const popupEl  = document.createElement('div');
        popupEl.className = 'custom-overlay';
        popupEl.innerHTML = `
            <button class="overlay-close" onclick="closeOverlay()">✕</button>
            <div class="overlay-title">${sec.emoji} ${loc.name}</div>
            <div class="overlay-desc">${loc.desc}</div>
        `;
        const popup = new kakao.maps.CustomOverlay({ content: popupEl, map: null, position, yAnchor: 1.1, zIndex: 100 });
        marker.addListener('click', () => { closeOverlay(); popup.setMap(map); activeOverlay = popup; });
        trafficMarkers.push(marker); bounds.extend(position);
    });
    if (resolved.length === 1) { map.setCenter(new kakao.maps.LatLng(resolved[0].lat, resolved[0].lng)); map.setLevel(5); }
    else                        { map.setBounds(bounds); }
}

const trafficFab    = document.getElementById('traffic-fab');
const trafficMenu   = document.getElementById('traffic-menu');
const trafficModal  = document.getElementById('traffic-modal');
const trafficModalTitle = document.getElementById('traffic-modal-title');
const trafficModalBody  = document.getElementById('traffic-modal-body');
let activeTrafficBtn = null;

function openTrafficModal() { trafficModal.classList.add('open'); }
function closeTrafficModal() {
    trafficModal.classList.remove('open');
    if (activeTrafficBtn) { activeTrafficBtn.classList.remove('active'); activeTrafficBtn = null; }
    clearTrafficMarkers();
}

trafficFab.addEventListener('click', () => {
    trafficMenu.classList.toggle('open');
    trafficFab.classList.toggle('active', trafficMenu.classList.contains('open'));
});
document.getElementById('traffic-modal-close').addEventListener('click', closeTrafficModal);
trafficModal.addEventListener('click', e => { if (e.target === trafficModal) closeTrafficModal(); });

TRAFFIC_SECTIONS.forEach(sec => {
    const btn = document.createElement('button');
    btn.className = 'traffic-menu-btn';
    btn.innerHTML = `<span>${sec.emoji}</span><span>${sec.name}</span>`;
    trafficMenu.appendChild(btn);
    btn.addEventListener('click', async () => {
        if (activeTrafficBtn === btn && trafficModal.classList.contains('open')) {
            closeTrafficModal(); return;
        }
        trafficMenu.classList.remove('open');
        trafficFab.classList.remove('active');
        if (activeTrafficBtn) activeTrafficBtn.classList.remove('active');
        activeTrafficBtn = btn;
        btn.classList.add('active');
        showTrafficMarkers(sec);
        trafficModalTitle.textContent = `${sec.emoji} ${sec.name}`;
        trafficModalBody.innerHTML = '<div style="color:#475569;padding:24px;text-align:center;font-size:0.85rem">불러오는 중…</div>';
        openTrafficModal();
        try {
            const resp = await fetch(`/api/traffic/${sec.key}`);
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            trafficModalBody.innerHTML = data.html;
        } catch (e) {
            trafficModalBody.innerHTML = `<div style="color:#ef4444;padding:20px;font-size:0.82rem">오류: ${e.message}</div>`;
        }
    });
});

document.getElementById('store-search').addEventListener('input', function () {
    currentPage = 1;
    renderPlaceList();
});

document.getElementById('page-size-select').addEventListener('change', function () {
    pageSize = parseInt(this.value);
    currentPage = 1;
    renderPlaceList();
});

function isInKorea(lat, lng) { return lat >= 33.0 && lat <= 38.9 && lng >= 124.5 && lng <= 132.0; }
function makeMyLocationMarker() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
        <circle cx="13" cy="13" r="11" fill="#1a73e8" fill-opacity="0.15" stroke="#1a73e8" stroke-width="1" stroke-opacity="0.4">
            <animate attributeName="r" values="8;13;8" dur="2.5s" repeatCount="indefinite"/>
            <animate attributeName="fill-opacity" values="0.15;0.03;0.15" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="13" cy="13" r="6" fill="#1a73e8" stroke="white" stroke-width="2.5"/>
    </svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return new kakao.maps.MarkerImage(url, new kakao.maps.Size(26, 26), { offset: new kakao.maps.Point(13, 13) });
}
let myLocationMarker = null;
if (navigator.geolocation) {
    const MY_MARKER_IMAGE = makeMyLocationMarker();
    navigator.geolocation.watchPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (!isInKorea(lat, lng)) return;
        const position = new kakao.maps.LatLng(lat, lng);
        if (!myLocationMarker)
            myLocationMarker = new kakao.maps.Marker({ map, position, image: MY_MARKER_IMAGE, title: '내 위치', zIndex: 10 });
        else myLocationMarker.setPosition(position);
    }, null, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
}

const sidebarToggle  = document.getElementById('sidebar-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarEl      = document.getElementById('sidebar');
const regionToggle   = document.getElementById('region-toggle');

function updateOverlay() {
    if (!isMobile()) { sidebarOverlay.classList.remove('visible'); return; }
    const anyOpen = sidebarEl.classList.contains('open') || regionPanel.classList.contains('open');
    sidebarOverlay.classList.toggle('visible', anyOpen);
}
function setTrafficFabVisible(visible) {
    const fab  = document.getElementById('traffic-fab');
    const menu = document.getElementById('traffic-menu');
    if (!fab) return;
    fab.style.opacity       = visible ? '' : '0';
    fab.style.pointerEvents = visible ? '' : 'none';
    if (!visible) { menu.classList.remove('open'); fab.classList.remove('active'); }
}

function openSidebar() {
    if (isMobile()) sidebarEl.classList.add('open');
    else             sidebarEl.classList.remove('collapsed');
    sidebarEl.scrollTop = 0;
    setTrafficFabVisible(false);
    updateOverlay();
}
function closeSidebar() {
    if (isMobile()) sidebarEl.classList.remove('open');
    else             sidebarEl.classList.add('collapsed');
    setTrafficFabVisible(true);
    updateOverlay();
}
function openRegionPanel()  {
    regionPanel.classList.add('open');
    regionToggle && regionToggle.classList.add('active');
    updateOverlay();
}
function closeRegionPanel() {
    regionPanel.classList.remove('open');
    regionToggle && regionToggle.classList.remove('active');
    updateOverlay();
}

sidebarToggle.addEventListener('click', () => {
    const isOpen = isMobile() ? sidebarEl.classList.contains('open') : !sidebarEl.classList.contains('collapsed');
    isOpen ? closeSidebar() : openSidebar();
});
sidebarOverlay.addEventListener('click', () => { closeSidebar(); closeRegionPanel(); });
document.getElementById('btn-list').addEventListener('click', closeSidebar);

if (regionToggle) {
    regionToggle.addEventListener('click', () => {
        if (regionPanel.classList.contains('open')) {
            closeRegionPanel();
        } else {
            closeSidebar();
            openRegionPanel();
        }
    });
}

const sidebarSearchBtn = document.getElementById('sidebar-search-btn');
if (sidebarSearchBtn) {
    sidebarSearchBtn.addEventListener('click', () => {
        if (selectedCats.size === 0 && activeCategories.size > 0) {
            // 카테고리 전체 해제 → 결과 삭제
            clearAllCategories();
            selectedRegions.clear();
            lastSearchedCats = new Set();
            regionPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            updateSidebarSearchBtn();
            closeSidebar();
            return;
        }
        closeSidebar();
        // 이전에 선택한 지역이 있으면 바로 탐색, 없으면 지역 선택 패널 열기
        if (selectedRegions.size > 0) {
            startSearch();
        } else {
            openRegionPanel();
        }
    });
}

document.getElementById('sidebar-close-btn').addEventListener('click', closeSidebar);
document.getElementById('region-close-btn').addEventListener('click', closeRegionPanel);

document.getElementById('results-toggle-btn').addEventListener('click', () => {
    if (isInfoPanelOpen()) closeInfoPanel();
    else showInfoPanel('store', infoPanelTitle.textContent);
});

// ===== 지역 패널 초기화 =====
function updateSearchBtnState() {
    document.getElementById('region-search-btn').disabled =
        !(selectedCats.size > 0 && selectedRegions.size > 0);
}

const regionList = document.getElementById('region-list');

Object.entries(YEOSU_DISTRICTS).forEach(([groupName, districts]) => {
    const divider = document.createElement('div');
    divider.className   = 'region-divider';
    divider.textContent = groupName;
    regionList.appendChild(divider);

    districts.forEach(district => {
        const label = document.createElement('label');
        label.className = 'region-item';

        const cb  = document.createElement('input');
        cb.type   = 'checkbox';
        cb.value  = district.name;
        cb.addEventListener('change', () => {
            if (cb.checked) {
                selectedRegions.add(district.name);
            } else {
                selectedRegions.delete(district.name);
            }
            updateSearchBtnState();
        });

        label.appendChild(cb);
        label.appendChild(document.createTextNode(district.name));
        regionList.appendChild(label);
    });
});

document.getElementById('region-select-all').addEventListener('click', () => {
    Object.values(YEOSU_DISTRICTS).flat().forEach(d => { selectedRegions.add(d.name); });
    regionList.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = true; });
    updateSearchBtnState();
});

document.getElementById('region-deselect-all').addEventListener('click', () => {
    regionList.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    selectedRegions.clear();
    updateSearchBtnState();
});

document.getElementById('region-search-btn').addEventListener('click', startSearch);

document.getElementById('region-search').addEventListener('input', function () {
    const q = this.value.trim();
    regionList.querySelectorAll('.region-item').forEach(item => {
        item.style.display = (!q || item.textContent.trim().includes(q)) ? '' : 'none';
    });
    regionList.querySelectorAll('.region-divider').forEach(divider => {
        let next = divider.nextElementSibling;
        let hasVisible = false;
        while (next && !next.classList.contains('region-divider')) {
            if (next.style.display !== 'none') hasVisible = true;
            next = next.nextElementSibling;
        }
        divider.style.display = hasVisible ? '' : 'none';
    });
});

// 로딩 오버레이 초기에는 숨김
document.getElementById('loading-overlay').style.display = 'none';
