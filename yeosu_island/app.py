from flask import Flask, render_template, jsonify
from traffic_data import PARKING, SHUTTLE, TRAIN, FLIGHT, BUS
import urllib.request
import urllib.parse
import re

app = Flask(__name__)


def build_table(rows):
    def cell(tag, c):
        a = (f' colspan="{c["c"]}"' if c['c'] > 1 else '') + (f' rowspan="{c["r"]}"' if c['r'] > 1 else '')
        return f'<{tag}{a}>{c["t"]}</{tag}>'
    head = '<tr>' + ''.join(cell('th', c) for c in rows[0]) + '</tr>'
    body = ''.join('<tr>' + ''.join(cell('td', c) for c in row) + '</tr>' for row in rows[1:])
    return f'<div class="scroll"><table class="tbl01"><thead>{head}</thead><tbody>{body}</tbody></table></div>'


def blocks_to_html(blocks):
    html = ''
    for b in blocks:
        if b['type'] == 'subtitle':
            html += f'<h4 class="sub_tit02">{b["text"]}</h4>'
        else:
            html += build_table(b['rows'])
    return html


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/traffic/parking')
def traffic_parking():
    return jsonify({'html': build_table(PARKING)})


@app.route('/api/traffic/shuttle')
def traffic_shuttle():
    subtitle = '<h4 class="sub_tit02">운행노선(안): 11개 노선 (육지 9, 섬 2)</h4>'
    return jsonify({'html': subtitle + build_table(SHUTTLE)})


@app.route('/api/traffic/train')
def traffic_train():
    return jsonify({'html': blocks_to_html(TRAIN)})


@app.route('/api/traffic/flight')
def traffic_flight():
    return jsonify({'html': blocks_to_html(FLIGHT)})


@app.route('/api/traffic/bus')
def traffic_bus():
    return jsonify({'html': blocks_to_html(BUS)})


_PLACE_HDR = {
    'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                   'AppleWebKit/537.36 (KHTML, like Gecko) '
                   'Chrome/124.0.0.0 Safari/537.36'),
    'Referer': 'https://map.kakao.com/',
    'Accept-Language': 'ko-KR,ko;q=0.9',
}


@app.route('/api/place/<place_id>')
def place_detail(place_id):
    url = f'https://place.map.kakao.com/{place_id}'
    try:
        req = urllib.request.Request(url, headers=_PLACE_HDR)
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode('utf-8')

        m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
        if not m:
            return jsonify({'photos': []})

        og_url = m.group(1)
        if og_url.startswith('//'):
            og_url = 'https:' + og_url

        # 사진 없는 가게는 og:image가 정적 지도 이미지로 채워짐 → 제외
        if 'staticmap' in og_url:
            return jsonify({'photos': []})

        # fname 파라미터에 원본 고화질 URL이 있으면 그것도 포함
        fname_m = re.search(r'[?&]fname=([^&"]+)', og_url)
        photos = [og_url]
        if fname_m:
            original = urllib.parse.unquote(fname_m.group(1))
            if original != og_url:
                photos.append(original)

        return jsonify({'photos': photos})

    except Exception as e:
        print(f'[place_detail] {place_id} error: {type(e).__name__}: {e}')
        return jsonify({'photos': [], 'error': str(e)})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
