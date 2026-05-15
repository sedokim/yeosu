from flask import Flask, render_template, jsonify
from traffic_data import PARKING, SHUTTLE, TRAIN, FLIGHT, BUS

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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
