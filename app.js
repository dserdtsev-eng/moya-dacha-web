// ⚠️ УКАЖИ ЗДЕСЬ СВОЙ РЕПОЗИТОРИЙ
const GITHUB_USER = 'dserdtsev-eng';
const GITHUB_REPO = 'moya-dacha-web';
const JSON_FILE = 'snt_data.json';

let appData = null;
let currentPlot = null;

// ─── ВСТРОЕННАЯ БИБЛИОТЕКА QR (qrcode-generator) ───
var qrcode = function () {
    var qrcode = function (typeNumber, errorCorrectionLevel) {
        var PAD0 = 0xEC, PAD1 = 0x11;
        var _typeNumber = typeNumber;
        var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
        var _modules = null, _moduleCount = 0, _dataCache = null, _dataList = [];
        var _this = {};
        var makeImpl = function (test, maskPattern) {
            _moduleCount = _typeNumber * 4 + 17;
            _modules = function (moduleCount) {
                var modules = new Array(moduleCount);
                for (var row = 0; row < moduleCount; row += 1) {
                    modules[row] = new Array(moduleCount);
                    for (var col = 0; col < moduleCount; col += 1) modules[row][col] = null;
                }
                return modules;
            }(_moduleCount);
            setupPositionProbePattern(0, 0); setupPositionProbePattern(_moduleCount - 7, 0); setupPositionProbePattern(0, _moduleCount - 7);
            setupPositionAdjustPattern(); setupTimingPattern(); setupTypeInfo(test, maskPattern);
            if (_typeNumber >= 7) setupTypeNumber(test);
            if (_dataCache == null) _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
            mapData(_dataCache, maskPattern);
        };
        var setupPositionProbePattern = function (row, col) {
            for (var r = -1; r <= 7; r += 1) {
                if (row + r <= -1 || _moduleCount <= row + r) continue;
                for (var c = -1; c <= 7; c += 1) {
                    if (col + c <= -1 || _moduleCount <= col + c) continue;
                    if ((0 <= r && r <= 6 && (c == 0 || c == 6)) || (0 <= c && c <= 6 && (r == 0 || r == 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) _modules[row + r][col + c] = true;
                    else _modules[row + r][col + c] = false;
                }
            }
        };
        var getBestMaskPattern = function () {
            var minLostPoint = 0, pattern = 0;
            for (var i = 0; i < 8; i += 1) { makeImpl(true, i); var lostPoint = QRUtil.getLostPoint(_this); if (i == 0 || minLostPoint > lostPoint) { minLostPoint = lostPoint; pattern = i; } }
            return pattern;
        };
        var setupTimingPattern = function () {
            for (var r = 8; r < _moduleCount - 8; r += 1) { if (_modules[r][6] != null) continue; _modules[r][6] = (r % 2 == 0); }
            for (var c = 8; c < _moduleCount - 8; c += 1) { if (_modules[6][c] != null) continue; _modules[6][c] = (c % 2 == 0); }
        };
        var setupPositionAdjustPattern = function () {
            var pos = QRUtil.getPatternPosition(_typeNumber);
            for (var i = 0; i < pos.length; i += 1) {
                for (var j = 0; j < pos.length; j += 1) {
                    var row = pos[i], col = pos[j];
                    if (_modules[row][col] != null) continue;
                    for (var r = -2; r <= 2; r += 1) {
                        for (var c = -2; c <= 2; c += 1) {
                            if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) _modules[row + r][col + c] = true;
                            else _modules[row + r][col + c] = false;
                        }
                    }
                }
            }
        };
        var setupTypeNumber = function (test) {
            var bits = QRUtil.getBCHTypeNumber(_typeNumber);
            for (var i = 0; i < 18; i += 1) { var mod = (!test && ((bits >> i) & 1) == 1); _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod; }
            for (var i = 0; i < 18; i += 1) { var mod = (!test && ((bits >> i) & 1) == 1); _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod; }
        };
        var setupTypeInfo = function (test, maskPattern) {
            var data = (_errorCorrectionLevel << 3) | maskPattern;
            var bits = QRUtil.getBCHTypeInfo(data);
            for (var i = 0; i < 15; i += 1) {
                var mod = (!test && ((bits >> i) & 1) == 1);
                if (i < 6) _modules[i][8] = mod; else if (i < 8) _modules[i + 1][8] = mod; else _modules[_moduleCount - 15 + i][8] = mod;
            }
            for (var i = 0; i < 15; i += 1) {
                var mod = (!test && ((bits >> i) & 1) == 1);
                if (i < 8) _modules[8][_moduleCount - i - 1] = mod; else if (i < 9) _modules[8][15 - i - 1 + 1] = mod; else _modules[8][15 - i - 1] = mod;
            }
            _modules[_moduleCount - 8][8] = (!test);
        };
        var mapData = function (data, maskPattern) {
            var inc = -1, row = _moduleCount - 1, bitIndex = 7, byteIndex = 0;
            var maskFunc = QRUtil.getMaskFunction(maskPattern);
            for (var col = _moduleCount - 1; col > 0; col -= 2) {
                if (col == 6) col -= 1;
                while (true) {
                    for (var c = 0; c < 2; c += 1) {
                        if (_modules[row][col - c] == null) {
                            var dark = false;
                            if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
                            var mask = maskFunc(row, col - c);
                            if (mask) dark = !dark;
                            _modules[row][col - c] = dark; bitIndex -= 1;
                            if (bitIndex == -1) { byteIndex += 1; bitIndex = 7; }
                        }
                    }
                    row += inc;
                    if (row < 0 || _moduleCount <= row) { row -= inc; inc = -inc; break; }
                }
            }
        };
        _this.addData = function (data) { var newData = qrNumber(data); _dataList.push(newData); _dataCache = null; };
        _this.isDark = function (row, col) { if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) throw row + ',' + col; return _modules[row][col]; };
        _this.getModuleCount = function () { return _moduleCount; };
        _this.make = function () { if (_typeNumber < 1) { var typeNumber = 1; for (; typeNumber < 40; typeNumber++) { var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel); var buffer = qrBitBuffer(); for (var i = 0; i < _dataList.length; i++) { var data = _dataList[i]; buffer.put(data.getMode(), 4); buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber)); data.write(buffer); } var totalDataCount = 0; for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount; if (buffer.getLengthInBits() <= totalDataCount * 8) break; } _typeNumber = typeNumber; } makeImpl(false, getBestMaskPattern()); };
        _this.createTableTag = function (cellSize, margin) { cellSize = cellSize || 2; margin = (typeof margin == 'undefined') ? cellSize * 4 : margin; var qrHtml = ''; qrHtml += '<table style="'; qrHtml += ' border-width: 0px; border-style: none; border-collapse: collapse;'; qrHtml += ' padding: 0px; margin: ' + margin + 'px;'; qrHtml += '">'; qrHtml += '<tbody>'; for (var r = 0; r < _this.getModuleCount(); r += 1) { qrHtml += '<tr>'; for (var c = 0; c < _this.getModuleCount(); c += 1) { qrHtml += '<td style="'; qrHtml += ' border-width: 0px; border-style: none; border-collapse: collapse;'; qrHtml += ' padding: 0px; margin: 0px;'; qrHtml += ' width: ' + cellSize + 'px;'; qrHtml += ' height: ' + cellSize + 'px;'; qrHtml += ' background-color: '; qrHtml += _this.isDark(r, c) ? '#000000' : '#ffffff'; qrHtml += ';'; qrHtml += '"/>'; } qrHtml += '</tr>'; } qrHtml += '</tbody>'; qrHtml += '</table>'; return qrHtml; };
        _this.createImgTag = function (cellSize, margin) { cellSize = cellSize || 2; margin = (typeof margin == 'undefined') ? cellSize * 4 : margin; var size = _this.getModuleCount() * cellSize + margin * 2; var min = margin, max = size - margin; return createImgTag(size, size, function (x, y) { if (min <= x && x < max && min <= y && y < max) { var c = Math.floor((x - min) / cellSize); var r = Math.floor((y - min) / cellSize); return _this.isDark(r, c) ? 0 : 1; } else return 1; }); };
        return _this;
    };
    var qrNumber = function (data) { var _mode = 1; var _data = data; var _this = {}; _this.getMode = function () { return _mode; }; _this.getLength = function () { return _data.length; }; _this.write = function (buffer) { for (var i = 0; i < _data.length; i += 1) buffer.put(_data.charCodeAt(i), 8); }; return _this; };
    var QRErrorCorrectionLevel = { L: 1, M: 0, Q: 3, H: 2 };
    var QRMode = { MODE_NUMBER: 1 << 0, MODE_ALPHA_NUM: 1 << 1, MODE_8BIT_BYTE: 1 << 2, MODE_KANJI: 1 << 3 };
    var QRMaskPattern = { PATTERN000: 0, PATTERN001: 1, PATTERN010: 2, PATTERN011: 3, PATTERN100: 4, PATTERN101: 5, PATTERN110: 6, PATTERN111: 7 };
	var QRUtil = { PATTERN_POSITION_TABLE: [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]], G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0), G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0), G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1), getBCHTypeInfo: function (data) { var d = data << 10; while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15))); return ((data << 10) | d) ^ QRUtil.G15_MASK; }, getBCHTypeNumber: function (data) { var d = data << 12; while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18))); return (data << 12) | d; }, getBCHDigit: function (data) { var digit = 0; while (data != 0) { digit += 1; data >>>= 1; } return digit; }, getPatternPosition: function (typeNumber) { return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1]; }, getMaskFunction: function (maskPattern) { switch (maskPattern) { case QRMaskPattern.PATTERN000: return function (i, j) { return (i + j) % 2 == 0; }; case QRMaskPattern.PATTERN001: return function (i, j) { return i % 2 == 0; }; case QRMaskPattern.PATTERN010: return function (i, j) { return j % 3 == 0; }; case QRMaskPattern.PATTERN011: return function (i, j) { return (i + j) % 3 == 0; }; case QRMaskPattern.PATTERN100: return function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0; }; case QRMaskPattern.PATTERN101: return function (i, j) { return (i * j) % 2 + (i * j) % 3 == 0; }; case QRMaskPattern.PATTERN110: return function (i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 == 0; }; case QRMaskPattern.PATTERN111: return function (i, j) { return ((i * j) % 3 + (i + j) % 2) % 2 == 0; }; default: throw 'bad maskPattern:' + maskPattern; } }, getErrorCorrectPolynomial: function (errorCorrectLength) { var a = qrPolynomial([1], 0); for (var i = 0; i < errorCorrectLength; i += 1) a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0)); return a; }, getLengthInBits: function (mode, type) { if (1 <= type && type < 10) { switch (mode) { case QRMode.MODE_NUMBER: return 10; case QRMode.MODE_ALPHA_NUM: return 9; case QRMode.MODE_8BIT_BYTE: return 8; case QRMode.MODE_KANJI: return 8; default: throw 'mode:' + mode; } } else if (type < 27) { switch (mode) { case QRMode.MODE_NUMBER: return 12; case QRMode.MODE_ALPHA_NUM: return 11; case QRMode.MODE_8BIT_BYTE: return 16; case QRMode.MODE_KANJI: return 10; default: throw 'mode:' + mode; } } else if (type < 41) { switch (mode) { case QRMode.MODE_NUMBER: return 14; case QRMode.MODE_ALPHA_NUM: return 13; case QRMode.MODE_8BIT_BYTE: return 16; case QRMode.MODE_KANJI: return 12; default: throw 'mode:' + mode; } } else { throw 'type:' + type; } }, getLostPoint: function (qrCode) { var moduleCount = qrCode.getModuleCount(), lostPoint = 0; for (var row = 0; row < moduleCount; row += 1) { for (var col = 0; col < moduleCount; col += 1) { var sameCount = 0, dark = qrCode.isDark(row, col); for (var r = -1; r <= 1; r += 1) { if (row + r < 0 || moduleCount <= row + r) continue; for (var c = -1; c <= 1; c += 1) { if (col + c < 0 || moduleCount <= col + c) continue; if (r == 0 && c == 0) continue; if (dark == qrCode.isDark(row + r, col + c)) sameCount += 1; } } if (sameCount > 5) lostPoint += (3 + sameCount - 5); } } for (var row = 0; row < moduleCount - 1; row += 1) { for (var col = 0; col < moduleCount - 1; col += 1) { var count = 0; if (qrCode.isDark(row, col)) count += 1; if (qrCode.isDark(row + 1, col)) count += 1; if (qrCode.isDark(row, col + 1)) count += 1; if (qrCode.isDark(row + 1, col + 1)) count += 1; if (count == 0 || count == 4) lostPoint += 3; } } for (var row = 0; row < moduleCount; row += 1) { for (var col = 0; col < moduleCount - 6; col += 1) { if (qrCode.isDark(row, col) && !qrCode.isDark(row, col + 1) && qrCode.isDark(row, col + 2) && qrCode.isDark(row, col + 3) && qrCode.isDark(row, col + 4) && !qrCode.isDark(row, col + 5) && qrCode.isDark(row, col + 6)) lostPoint += 40; } } for (var col = 0; col < moduleCount; col += 1) { for (var row = 0; row < moduleCount - 6; row += 1) { if (qrCode.isDark(row, col) && !qrCode.isDark(row + 1, col) && qrCode.isDark(row + 2, col) && qrCode.isDark(row + 3, col) && qrCode.isDark(row + 4, col) && !qrCode.isDark(row + 5, col) && qrCode.isDark(row + 6, col)) lostPoint += 40; } } var darkCount = 0; for (var col = 0; col < moduleCount; col += 1) { for (var row = 0; row < moduleCount; row += 1) { if (qrCode.isDark(row, col)) darkCount += 1; } } var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5; lostPoint += ratio * 10; return lostPoint; } };
    var QRMath = { glog: function (n) { if (n < 1) throw 'glog(' + n + ')'; return QRMath.LOG_TABLE[n]; }, gexp: function (n) { while (n < 0) n += 255; while (n >= 256) n -= 255; return QRMath.EXP_TABLE[n]; }, EXP_TABLE: new Array(256), LOG_TABLE: new Array(256) };
    for (var i = 0; i < 8; i += 1) QRMath.EXP_TABLE[i] = 1 << i;
    for (var i = 8; i < 256; i += 1) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
    for (var i = 0; i < 255; i += 1) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
    var qrPolynomial = function (num, shift) { if (typeof num.length == 'undefined') throw num.length + '/' + shift; var _num = function () { var offset = 0; while (offset < num.length && num[offset] == 0) offset += 1; var _num = new Array(num.length - offset + shift); for (var i = 0; i < num.length - offset; i += 1) _num[i] = num[i + offset]; return _num; }(); var _this = {}; _this.getAt = function (index) { return _num[index]; }; _this.getLength = function () { return _num.length; }; _this.multiply = function (e) { var num = new Array(_this.getLength() + e.getLength() - 1); for (var i = 0; i < _this.getLength(); i += 1) { for (var j = 0; j < e.getLength(); j += 1) num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j))); } return qrPolynomial(num, 0); }; _this.mod = function (e) { if (_this.getLength() - e.getLength() < 0) return _this; var ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0)); var num = new Array(_this.getLength()); for (var i = 0; i < _this.getLength(); i += 1) num[i] = _this.getAt(i); for (var i = 0; i < e.getLength(); i += 1) num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio); return qrPolynomial(num, 0).mod(e); }; return _this; };
    var QRRSBlock = { RS_BLOCK_TABLE: [[1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9], [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16], [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13], [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9], [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12], [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15], [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14], [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15], [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13], [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16], [4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13], [2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15], [4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12], [3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13], [5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12], [5, 122, 98, 1, 123, 99], [7, 73, 45, 3, 74, 46], [15, 43, 19, 2, 44, 20], [3, 45, 15, 13, 46, 16], [1, 135, 107, 5, 136, 108], [10, 74, 46, 1, 75, 47], [1, 50, 22, 15, 51, 23], [2, 42, 14, 17, 43, 15], [5, 150, 120, 1, 151, 121], [9, 69, 43, 4, 70, 44], [17, 50, 22, 1, 51, 23], [2, 42, 14, 17, 43, 15], [3, 141, 113, 4, 142, 114], [3, 70, 44, 11, 71, 45], [17, 47, 21, 4, 48, 22], [9, 39, 13, 16, 40, 14], [3, 135, 107, 5, 136, 108], [3, 67, 41, 13, 68, 42], [15, 54, 24, 5, 55, 25], [15, 43, 15, 10, 44, 16], [4, 144, 116, 4, 145, 117], [17, 68, 42], [17, 50, 22, 6, 51, 23], [19, 46, 16, 6, 47, 17], [2, 139, 111, 7, 140, 112], [17, 74, 46], [7, 54, 24, 16, 55, 25], [34, 37, 13], [4, 151, 121, 5, 152, 122], [4, 75, 47, 14, 76, 48], [11, 54, 24, 14, 55, 25], [16, 45, 15, 14, 46, 16], [6, 147, 117, 4, 148, 118], [6, 73, 45, 14, 74, 46], [11, 54, 24, 16, 55, 25], [30, 46, 16, 2, 47, 17], [8, 132, 106, 4, 133, 107], [8, 75, 47, 13, 76, 48], [7, 54, 24, 22, 55, 25], [22, 45, 15, 13, 46, 16], [10, 142, 114, 2, 143, 115], [19, 74, 46, 4, 75, 47], [28, 50, 22, 6, 51, 23], [33, 46, 16, 4, 47, 17], [8, 152, 122, 4, 153, 123], [22, 73, 45, 3, 74, 46], [8, 53, 23, 26, 54, 24], [12, 45, 15, 28, 46, 16], [3, 147, 117, 10, 148, 118], [3, 73, 45, 23, 74, 46], [4, 54, 24, 31, 55, 25], [11, 45, 15, 31, 46, 16], [7, 146, 116, 7, 147, 117], [21, 73, 45, 7, 74, 46], [1, 53, 23, 37, 54, 24], [19, 45, 15, 26, 46, 16], [5, 145, 115, 10, 146, 116], [19, 75, 47, 10, 76, 48], [15, 54, 24, 25, 55, 25], [23, 45, 15, 25, 46, 16], [13, 145, 115, 3, 146, 116], [2, 74, 46, 29, 75, 47], [42, 54, 24, 1, 55, 25], [23, 45, 15, 28, 46, 16], [17, 145, 115], [10, 74, 46, 23, 75, 47], [10, 54, 24, 35, 55, 25], [19, 45, 15, 35, 46, 16], [18, 145, 115, 1, 146, 116], [14, 74, 46, 21, 75, 47], [29, 54, 24, 19, 55, 25], [11, 45, 15, 46, 46, 16], [20, 145, 115, 4, 146, 116], [14, 74, 46, 23, 75, 47], [44, 54, 24, 7, 55, 25], [59, 46, 16, 1, 47, 17], [16, 145, 115, 4, 146, 116], [23, 75, 47]];
	var QRRSBlock = { getRSBlocks: function (typeNumber, errorCorrectionLevel) { var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectionLevel); if (typeof rsBlock == 'undefined') throw 'bad rs block'; var length = rsBlock.length / 3; var list = []; for (var i = 0; i < length; i += 1) { var count = rsBlock[i * 3 + 0]; var totalCount = rsBlock[i * 3 + 1]; var dataCount = rsBlock[i * 3 + 2]; for (var j = 0; j < count; j += 1) list.push({ totalCount: totalCount, dataCount: dataCount }); } return list; }, getRsBlockTable: function (typeNumber, errorCorrectionLevel) { switch (errorCorrectionLevel) { case QRErrorCorrectionLevel.L: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0]; case QRErrorCorrectionLevel.M: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1]; case QRErrorCorrectionLevel.Q: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2]; case QRErrorCorrectionLevel.H: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3]; default: return undefined; } } };
    var qrBitBuffer = function () { var _buffer = [], _length = 0; var _this = {}; _this.getBuffer = function () { return _buffer; }; _this.getAt = function (index) { var bufIndex = Math.floor(index / 8); return ((_buffer[bufIndex] >>> (7 - index % 8)) & 1) == 1; }; _this.put = function (num, length) { for (var i = 0; i < length; i += 1) { _this.putBit(((num >>> (length - i - 1)) & 1) == 1); } }; _this.getLengthInBits = function () { return _length; }; _this.putBit = function (bit) { var bufIndex = Math.floor(_length / 8); if (_buffer.length <= bufIndex) _buffer.push(0); if (bit) _buffer[bufIndex] |= (0x80 >>> (_length % 8)); _length += 1; }; return _this; };
    var createData = function (typeNumber, errorCorrectionLevel, dataList) { var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel); var buffer = qrBitBuffer(); for (var i = 0; i < dataList.length; i += 1) { var data = dataList[i]; buffer.put(data.getMode(), 4); buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber)); data.write(buffer); } var totalDataCount = 0; for (var i = 0; i < rsBlocks.length; i += 1) totalDataCount += rsBlocks[i].dataCount; if (buffer.getLengthInBits() > totalDataCount * 8) throw 'code length overflow. (' + buffer.getLengthInBits() + '>' + totalDataCount * 8 + ')'; if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4); while (buffer.getLengthInBits() % 8 != 0) buffer.putBit(false); while (true) { if (buffer.getLengthInBits() >= totalDataCount * 8) break; buffer.put(PAD0, 8); if (buffer.getLengthInBits() >= totalDataCount * 8) break; buffer.put(PAD1, 8); } return createBytes(buffer, rsBlocks); };
    var createBytes = function (buffer, rsBlocks) { var offset = 0, maxDcCount = 0, maxEcCount = 0; var dcdata = new Array(rsBlocks.length), ecdata = new Array(rsBlocks.length); for (var r = 0; r < rsBlocks.length; r += 1) { var dcCount = rsBlocks[r].dataCount, ecCount = rsBlocks[r].totalCount - dcCount; maxDcCount = Math.max(maxDcCount, dcCount); maxEcCount = Math.max(maxEcCount, ecCount); dcdata[r] = new Array(dcCount); for (var i = 0; i < dcdata[r].length; i += 1) dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset]; offset += dcCount; var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount); var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1); var modPoly = rawPoly.mod(rsPoly); ecdata[r] = new Array(rsPoly.getLength() - 1); for (var i = 0; i < ecdata[r].length; i += 1) { var modIndex = i + modPoly.getLength() - ecdata[r].length; ecdata[r][i] = (modIndex >= 0) ? modPoly.getAt(modIndex) : 0; } } var totalCodeCount = 0; for (var i = 0; i < rsBlocks.length; i += 1) totalCodeCount += rsBlocks[i].totalCount; var data = new Array(totalCodeCount); var index = 0; for (var i = 0; i < maxDcCount; i += 1) { for (var r = 0; r < rsBlocks.length; r += 1) { if (i < dcdata[r].length) data[index++] = dcdata[r][i]; } } for (var i = 0; i < maxEcCount; i += 1) { for (var r = 0; r < rsBlocks.length; r += 1) { if (i < ecdata[r].length) data[index++] = ecdata[r][i]; } } return data; };
    var createImgTag = function (width, height, getPixel) { var gif = '', length = width * height; for (var i = 0; i < length; i += 1) { gif += String.fromCharCode(getPixel(i % width, Math.floor(i / width)) ? 0 : 1); } return '<img src="data:image/gif;base64,R0lGODlh' + width + 'x' + height + 'AI' + encodeGif(gif) + '" width="' + width + '" height="' + height + '" border="0"/>'; };
    var encodeGif = function (data) { var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; var n = data.length, n1 = 0, n2 = 0, n3 = 0, base64 = ""; for (var i = 0; i < n; i += 3) { n1 = data.charCodeAt(i); if (i + 1 < n) n2 = data.charCodeAt(i + 1); else n2 = 0; if (i + 2 < n) n3 = data.charCodeAt(i + 2); else n3 = 0; base64 += B64.charAt(n1 >> 2) + B64.charAt(((n1 & 3) << 4) | (n2 >> 4)) + B64.charAt(((n2 & 15) << 2) | (n3 >> 6)) + B64.charAt(n3 & 63); } return base64; };
    return qrcode;
}();

// ─── УТИЛИТЫ ───
async function pbkdf2(password, saltBase64) {
    const enc = new TextEncoder();
    const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), {name: 'PBKDF2'}, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({
        name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256'
    }, keyMaterial, 256);
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

function formatMoney(amount) {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' ₽';
}

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateRu(dateStr) {
    if (!dateStr || dateStr === '—') return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return dateStr;
}

// ─── ЗАГРУЗКА ДАННЫХ ───
async function loadData(isRefresh = false) {
    if (!isRefresh) showScreen('loading');
    try {
        const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/${JSON_FILE}?t=${Date.now()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Не удалось скачать базу');
        appData = await response.json();
        
        if (isRefresh && currentPlot) {
            currentPlot.data = appData.plots[currentPlot.id];
            document.querySelectorAll('.tab-btn').forEach(btn => {
                if (btn.classList.contains('active')) renderTab(btn.dataset.tab);
            });
            const toast = document.createElement('div');
            toast.textContent = 'Данные обновлены';
            toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--primary);color:white;padding:10px 20px;border-radius:20px;z-index:1000;';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        } else {
            initLoginScreen();
            showScreen('login-screen');
            const savedPlotId = localStorage.getItem('snt_plot_id');
            if (savedPlotId && appData.plots[savedPlotId]) {
                document.getElementById('street-select').value = appData.plots[savedPlotId].street;
                document.getElementById('street-select').dispatchEvent(new Event('change'));
                document.getElementById('house-select').value = savedPlotId;
            }
        }
    } catch (e) {
        if (!isRefresh) alert('Ошибка загрузки данных: ' + e.message);
        else alert('Не удалось обновить данные: ' + e.message);
    }
}

// ─── ЭКРАН ВХОДА ───
function initLoginScreen() {
    const streetSelect = document.getElementById('street-select');
    const houseSelect = document.getElementById('house-select');
    const pwdInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');

    const streets = new Set();
    Object.values(appData.plots).forEach(p => { if(p.street) streets.add(p.street); });

    streetSelect.innerHTML = '<option value="">Выберите улицу</option>';
    Array.from(streets).sort().forEach(s => {
        streetSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });

    streetSelect.onchange = () => {
        const selectedStreet = streetSelect.value;
        houseSelect.innerHTML = '<option value="">Выберите дом</option>';
        if (!selectedStreet) return;
        Object.entries(appData.plots).forEach(([id, p]) => {
            if (p.street === selectedStreet) {
                houseSelect.innerHTML += `<option value="${id}">${p.house}</option>`;
            }
        });
        checkLoginReady();
    };

    houseSelect.onchange = checkLoginReady;
    pwdInput.oninput = checkLoginReady;

    function checkLoginReady() {
        loginBtn.disabled = !(houseSelect.value && pwdInput.value.length === 4);
    }

    loginBtn.onclick = async () => {
        const plotId = houseSelect.value;
        const pwd = pwdInput.value;
        const errEl = document.getElementById('login-error');
        
        errEl.textContent = 'Проверка...';
        const plot = appData.plots[plotId];
        try {
            if (!plot.passport_hash || !plot.passport_salt) {
                errEl.textContent = 'Пароль для этого участка не задан';
                return;
            }
            const hash = await pbkdf2(pwd, plot.passport_salt);
            if (hash === plot.passport_hash) {
                currentPlot = { id: plotId, data: plot };
                if (document.getElementById('remember-me').checked) {
                    localStorage.setItem('snt_plot_id', plotId);
                } else {
                    localStorage.removeItem('snt_plot_id');
                }
                errEl.textContent = '';
                pwdInput.value = '';
                showScreen('dashboard-screen');
                renderDashboard();
            } else {
                errEl.textContent = 'Неверный пароль';
            }
        } catch (e) {
            errEl.textContent = 'Ошибка проверки пароля';
        }
    };
}

// ─── ДАШБОРД ───
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function renderDashboard() {
    const plot = currentPlot.data;
    document.getElementById('user-name').textContent = plot.owner || 'Участок';
    document.getElementById('user-address').textContent = `${plot.street} ${plot.house}`;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTab(btn.dataset.tab);
        };
    });
    renderTab('debts');
}

// ─── ЛОГИКА РАСЧЁТА ───
function addYearMinusDay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return '';
    d.setFullYear(d.getFullYear() + 1);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

function paymentPeriod(payment) {
    const explicit = (payment.period || '').trim().toLowerCase();
    if (explicit === 'prev' || explicit === 'current') return explicit;
    const s = appData.settings;
    const pd = payment.date;
    if (!pd) return null;
    const curStart = s.fee_start_date || '';
    const prevStart = s.prev_fee_start_date || '';
    if (curStart && pd >= curStart && pd <= addYearMinusDay(curStart)) return 'current';
    if (prevStart && pd >= prevStart && pd <= addYearMinusDay(prevStart)) return 'prev';
    if (curStart && pd < curStart) return 'prev';
    if (!curStart) return 'current';
    return null;
}

function isMemberPayment(desc) { return (desc || '').toLowerCase().includes('членск'); }
function isTargetPayment(desc) { return (desc || '').toLowerCase().includes('целев'); }
function isElectricPayment(desc) { return (desc || '').toLowerCase().includes('электр'); }

function sumPaymentsInPeriod(plotId, predicate, period) {
    let total = 0;
    for (const p of (appData.payments || [])) {
        if (String(p.plot) !== String(plotId)) continue;
        if (!predicate(p.description || '')) continue;
        if (paymentPeriod(p) === period) total += Number(p.amount) || 0;
    }
    return total;
}

function getMemberDebt(plot, plotId) {
    const s = appData.settings;
    const fee = Number(s.member_fee || 0);
    if (!s.fee_start_date || fee <= 0) return 0;
    const paid = sumPaymentsInPeriod(plotId, isMemberPayment, 'current');
    return Math.max(0, fee - Number(plot.member_promo || 0) - paid);
}
function getTargetDebt(plot, plotId) {
    const s = appData.settings;
    const fee = Number(s.target_fee || 0);
    if (!s.fee_start_date || fee <= 0) return 0;
    const paid = sumPaymentsInPeriod(plotId, isTargetPayment, 'current');
    return Math.max(0, fee - paid);
}
function getPrevMemberDebt(plot, plotId) {
    const s = appData.settings;
    const fee = Number(s.prev_member_fee || 0);
    if (fee <= 0 || !s.prev_fee_start_date) return 0;
    const paid = sumPaymentsInPeriod(plotId, isMemberPayment, 'prev');
    return Math.max(0, fee - Number(plot.member_promo_prev || 0) - paid);
}
function getPrevTargetDebt(plot, plotId) {
    const s = appData.settings;
    const fee = Number(s.prev_target_fee || 0);
    if (fee <= 0 || !s.prev_fee_start_date) return 0;
    const paid = sumPaymentsInPeriod(plotId, isTargetPayment, 'prev');
    return Math.max(0, fee - paid);
}

function getTotalDebt(plot, plotId) {
    return getMemberDebt(plot, plotId) + getTargetDebt(plot, plotId) + getPrevMemberDebt(plot, plotId) + getPrevTargetDebt(plot, plotId);
}
// ─── ЛОГИКА ЭЛЕКТРИЧЕСТВА ───
function getLastReplacementDate(plot) {
    let latest = '';
    for (const r of (plot.meter_readings || [])) {
        if (r.replaced && (r.date || '') > latest) latest = r.date;
    }
    return latest;
}

function getElectricSummary(plot) {
    const readings = plot.meter_readings || [];
    const lastRepl = getLastReplacementDate(plot);
    
    const relevantReadings = readings.filter(r => !lastRepl || (r.date || '') >= lastRepl).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    const lastReading = relevantReadings[relevantReadings.length - 1];
    const lastVal = lastReading ? Number(lastReading.values["1"] || 0) : 0;

    let consumed = 0;
    for (let i = 1; i < relevantReadings.length; i++) {
        if (!relevantReadings[i].replaced) {
            const v1 = Number(relevantReadings[i-1].values["1"] || 0);
            const v2 = Number(relevantReadings[i].values["1"] || 0);
            if (v2 > v1) consumed += (v2 - v1);
        }
    }

    let paidKwh = 0;
    const tariffs = (appData.tariffs || []).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    for (const p of (appData.payments || [])) {
        if (String(p.plot) !== String(plot.id) || !isElectricPayment(p.description)) continue;
        if (lastRepl && p.date < lastRepl) continue;
        
        let tPrice = 0;
        for (const t of tariffs) { if (t.date <= p.date) tPrice = t.price; }
        if (tPrice > 0) paidKwh += (Number(p.amount) / tPrice);
    }
    
    return { lastVal, consumed, paidKwh, balance: paidKwh - consumed };
}

// ─── РЕНДЕР ВКЛАДОК ───
function renderTab(tab) {
    const content = document.getElementById('tab-content');
    const plotId = currentPlot.id;
    const plot = currentPlot.data;
    const settings = appData.settings;

    if (tab === 'debts') {
        const totalDebt = getTotalDebt(plot, plotId);
        let html = '<h3>Задолженности</h3>';
        if (totalDebt === 0) {
            html += '<div class="card card-blue" style="text-align:center; font-size:18px; font-weight:bold; padding:30px 20px;">✓ Задолженностей по взносам нет</div>';
        } else {
            html += `<div class="card card-blue">
                <div style="font-size: 18px; margin-bottom: 10px;">Общая сумма долга</div>
                <div style="font-size: 32px; font-weight: bold; color: var(--primary);">${formatMoney(totalDebt)}</div>
            </div>`;
            html += `<div class="card">
                <div class="row"><span>За текущий период</span><span>${formatMoney(getMemberDebt(plot, plotId) + getTargetDebt(plot, plotId))}</span></div>
                <div class="row"><span>За прошлый период</span><span>${formatMoney(getPrevMemberDebt(plot, plotId) + getPrevTargetDebt(plot, plotId))}</span></div>
            </div>`;
        }
        content.innerHTML = html;
    }
    
    else if (tab === 'payments') {
        const payments = (appData.payments || []).filter(p => String(p.plot) === String(plotId)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        let html = '<h3>История платежей</h3>';
        if (payments.length === 0) html += '<p>Платежей пока нет</p>';
        else {
            payments.forEach(p => {
                let periodText = p.period === 'prev' ? 'прошлый период' : (p.period === 'current' ? 'текущий период' : '');
                html += `
                    <div class="card">
                        <div style="font-size: 16px; color: var(--text-light); margin-bottom: 5px;">${formatDateRu(p.date)}</div>
                        <div class="row" style="padding:0;">
                            <span style="font-size: 18px;">${p.description || 'Платёж'}</span>
                            <span style="font-size: 20px; color: var(--primary);">${formatMoney(Number(p.amount))}</span>
                        </div>
                        ${periodText ? `<div style="font-size: 14px; color: var(--text-light); margin-top: 5px;">${periodText}</div>` : ''}
                    </div>`;
            });
        }
        content.innerHTML = html;
    }

    else if (tab === 'readings') {
        const readings = (plot.meter_readings || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        let html = '<h3>Показания счётчиков</h3>';
        if (readings.length === 0) html += '<p>Показаний пока нет</p>';
        else {
            readings.forEach(r => {
                const val = r.values && r.values["1"] !== undefined ? r.values["1"] : '—';
                html += `
                    <div class="card">
                        <div style="font-size: 16px; color: var(--text-light); margin-bottom: 5px;">${formatDateRu(r.date)}</div>
                        <div class="row" style="padding:0;">
                            <span style="font-size: 18px;">Счётчик</span>
                            <span style="font-size: 20px; font-weight: bold;">${val}</span>
                        </div>
                    </div>`;
            });
        }
        content.innerHTML = html;
    }

    else if (tab === 'electric') {
        const summary = getElectricSummary({ ...plot, id: plotId });
        const lastRepl = getLastReplacementDate(plot);

        let html = '<h3>Электричество</h3>';
        html += `<div style="color: var(--text-light); margin-bottom: 15px;">Период: с ${lastRepl ? formatDateRu(lastRepl) : 'начала'} (после замены счётчика)</div>`;
        html += `<div class="card">
            <h4 style="font-size: 18px; margin-bottom: 15px;">Баланс</h4>
            <div class="row"><span>Оплачено, кВт·ч</span><span>${summary.paidKwh.toFixed(1)}</span></div>
            <div class="row"><span>Израсходовано, кВт·ч</span><span>${summary.consumed.toFixed(1)}</span></div>
            <div class="row total" style="border-top: 1px solid var(--border); padding-top: 10px; margin-top: 10px;">
                <span>Итог</span><span style="color: ${summary.balance < 0 ? 'var(--error)' : 'var(--success)'}">${summary.balance.toFixed(1)}</span>
            </div>
        </div>`;

        html += `<h4 style="font-size: 18px; margin-top: 25px; margin-bottom: 15px;">Оплаченные кВт·ч</h4>`;
        const tariffs = (appData.tariffs || []).sort((a,b) => (a.date||'').localeCompare(b.date||''));
        const ePayments = (appData.payments || []).filter(p => String(p.plot) === String(plotId) && isElectricPayment(p.description)).sort((a,b) => b.date.localeCompare(a.date));
        
        if (ePayments.length === 0) html += '<p>Платежей за электричество нет</p>';
        else {
            ePayments.forEach(p => {
                let tPrice = 0;
                for (const t of tariffs) { if (t.date <= p.date) tPrice = t.price; }
                const kwh = tPrice > 0 ? (p.amount / tPrice).toFixed(0) : '—';
                html += `<div class="card">
                    <div style="font-size: 16px; color: var(--text-light); margin-bottom: 5px;">${formatDateRu(p.date)}</div>
                    <div class="row" style="padding:0;">
                        <div style="font-size: 14px; color: var(--text-light);">${formatMoney(p.amount)} ÷ ${Number(tPrice).toFixed(2)} ₽/кВт·ч</div>
                        <span style="font-size: 20px; font-weight: bold;">${kwh}</span>
                    </div>
                </div>`;
            });
        }
        content.innerHTML = html;
    }

    else if (tab === 'deadlines') {
        const feeStart = settings.fee_start_date || '—';
        const feeEnd = feeStart !== '—' ? addYearMinusDay(feeStart) : '—';
        let html = '<h3>Сроки оплаты</h3>';
        
        if (Number(settings.member_fee) > 0) {
            html += `<div class="card">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Годовой членский взнос</div>
                <div class="row" style="padding: 5px 0;"><span>Сумма:</span><span>${formatMoney(settings.member_fee)}</span></div>
                <div class="row" style="padding: 5px 0;"><span>Срок:</span><span>${formatDateRu(settings.member_deadline) || 'не указан'}</span></div>
            </div>`;
        }
        if (Number(settings.target_fee) > 0) {
            html += `<div class="card">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Годовой целевой взнос</div>
                <div class="row" style="padding: 5px 0;"><span>Сумма:</span><span>${formatMoney(settings.target_fee)}</span></div>
                <div class="row" style="padding: 5px 0;"><span>Срок:</span><span>${formatDateRu(settings.target_deadline) || 'не указан'}</span></div>
            </div>`;
        }
        html += `<div class="card">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Электроэнергия</div>
            <div class="row" style="padding: 5px 0;"><span>Срок:</span><span>до ${settings.electric_day} числа каждого месяца</span></div>
        </div>`;
        html += `<div class="card">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Период взносов</div>
            <div class="row" style="padding: 5px 0;"><span>С:</span><span>${formatDateRu(feeStart)}</span></div>
            <div class="row" style="padding: 5px 0;"><span>По:</span><span>${formatDateRu(feeEnd)}</span></div>
        </div>`;
        content.innerHTML = html;
    }

    else if (tab === 'qr') {
        renderQRTab(plot, plotId, content);
    }
}

// ─── ВКЛАДКА «QR» ───
function renderQRTab(plot, plotId, content) {
    let totalDebt = getTotalDebt(plot, plotId);
    const summary = getElectricSummary({ ...plot, id: plotId });

    let html = `
        <div class="card">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">Участок: ${plot.street} ${plot.house}</div>
            <div style="font-size: 18px; color: var(--text-light);">Владелец: ${plot.owner || '—'}</div>
        </div>
        <h3 style="margin-top: 10px;">За что платим?</h3>
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button id="qr-btn-vznos" class="btn-pill" style="flex: 1; background: var(--primary); color: white;">Взносы</button>
            <button id="qr-btn-electro" class="btn-pill" style="flex: 1; background: white; color: var(--text); border: 1px solid var(--border);">Электро</button>
        </div>
        <div id="qr-content-area"></div>
    `;
    content.innerHTML = html;

    const btnVznos = document.getElementById('qr-btn-vznos');
    const btnElectro = document.getElementById('qr-btn-electro');
    const area = document.getElementById('qr-content-area');

    function setActiveTab(isVznos) {
        if (isVznos) {
            btnVznos.style.background = 'var(--primary)'; btnVznos.style.color = 'white'; btnVznos.style.border = 'none';
            btnElectro.style.background = 'white'; btnElectro.style.color = 'var(--text)'; btnElectro.style.border = '1px solid var(--border)';
            renderQRVznos(area, plot, totalDebt);
        } else {
            btnElectro.style.background = 'var(--primary)'; btnElectro.style.color = 'white'; btnElectro.style.border = 'none';
            btnVznos.style.background = 'white'; btnVznos.style.color = 'var(--text)'; btnVznos.style.border = '1px solid var(--border)';
            renderQRElectro(area, plot, summary);
        }
    }

    btnVznos.onclick = () => setActiveTab(true);
    btnElectro.onclick = () => setActiveTab(false);
    setActiveTab(true);
}

// ─── РЕНДЕР QR ДЛЯ ВЗНОСОВ ───
function renderQRVznos(area, plot, totalDebt) {
    if (totalDebt <= 0) {
        area.innerHTML = `
            <div class="card card-blue" style="text-align: center; font-size: 20px; padding: 30px 20px;">
                Сумма к оплате<br><br><span style="font-size: 32px; font-weight: bold;">0,00 ₽</span>
            </div>
            <div class="card" style="text-align: center; font-size: 18px; color: var(--text-light); padding: 30px 20px;">
                Нет задолженности по взносам
            </div>`;
        return;
    }

    area.innerHTML = `
        <div class="card card-blue" style="text-align: center; padding: 20px;">
            <div style="font-size: 18px;">Сумма к оплате</div>
            <div style="font-size: 36px; font-weight: bold; color: var(--primary); margin-top: 10px;">${formatMoney(totalDebt)}</div>
        </div>
        <div style="text-align: center; margin-top: 20px;" id="qr-wrapper">
            <h4 style="font-size: 20px; margin-bottom: 15px;">QR-код для оплаты</h4>
            <div id="qr-target" style="display: flex; justify-content: center; margin-bottom: 15px; background: white; padding: 15px; border-radius: 12px; min-height: 240px;"></div>
            <p style="color: var(--text-light); font-size: 16px; margin-bottom: 20px;">Откройте приложение банка →<br>«Оплата по QR» → наведите камеру</p>
            <button id="save-qr-btn" class="btn-pill" style="background: var(--primary); color: white; margin-bottom: 10px;">💾 Сохранить QR в галерею</button>
        </div>`;

    const purpose = `${plot.street} ${plot.house}, взносы`;
    const qrData = buildPaymentQR(plot, totalDebt, purpose);
    
    setTimeout(() => {
        const qrTarget = document.getElementById('qr-target');
        if (qrTarget) {
            qrTarget.innerHTML = '';
            const qr = qrcode(0, 'M');
            qr.addData(qrData);
            qr.make();
            qrTarget.innerHTML = qr.createImgTag(5, 5);
            const img = qrTarget.querySelector('img');
            if (img) { img.style.width = '240px'; img.style.height = '240px'; }
            document.getElementById('save-qr-btn').onclick = () => saveQRToGallery('qr-target');
        }
    }, 100);
}

// ─── РЕНДЕР QR ДЛЯ ЭЛЕКТРО ───
function renderQRElectro(area, plot, summary) {
    const today = todayStr();
    let currentTariff = 0;
    for (const t of (appData.tariffs || [])) { if (t.date <= today) currentTariff = t.price; }
    
    area.innerHTML = `
        <div class="card">
            <div style="font-size: 18px; margin-bottom: 15px;">Текущее показание счётчика:</div>
            <input type="number" id="qr-electro-input" class="input-large" placeholder="Показание" value="${summary.lastVal || ''}">
            <div class="row" style="margin-top: 15px;"><span>Предыдущее: ${summary.lastVal}</span></div>
            <div class="row"><span>Расход: <span id="qr-delta">0</span> кВт·ч</span></div>
            <div class="row"><span>Тариф: ${Number(currentTariff).toFixed(2)} ₽/кВт·ч</span></div>
        </div>
        <div class="card card-blue" style="text-align: center; padding: 20px;">
            <div style="font-size: 18px;">Сумма к оплате</div>
            <div id="qr-electro-sum" style="font-size: 36px; font-weight: bold; color: var(--primary); margin-top: 10px;">0,00 ₽</div>
            <div id="qr-electro-err" style="color: var(--error); font-size: 16px; margin-top: 10px; display: none;">Введите показание больше предыдущего</div>
        </div>
        <div id="qr-electro-block" style="text-align: center; margin-top: 20px; display: none;">
            <h4 style="font-size: 20px; margin-bottom: 15px;">QR-код для оплаты</h4>
            <div id="qr-target" style="display: flex; justify-content: center; margin-bottom: 15px; background: white; padding: 15px; border-radius: 12px; min-height: 240px;"></div>
            <p style="color: var(--text-light); font-size: 16px; margin-bottom: 20px;">Откройте приложение банка →<br>«Оплата по QR» → наведите камеру</p>
            <button id="save-qr-btn" class="btn-pill" style="background: var(--primary); color: white; margin-bottom: 10px;">💾 Сохранить QR в галерею</button>
        </div>`;

    const input = document.getElementById('qr-electro-input');
    const deltaSpan = document.getElementById('qr-delta');
    const sumDiv = document.getElementById('qr-electro-sum');
    const errDiv = document.getElementById('qr-electro-err');
    const qrBlock = document.getElementById('qr-electro-block');

    input.oninput = () => {
        const val = parseFloat(input.value);
        const prev = summary.lastVal;
        
        if (isNaN(val) || val <= prev) {
            deltaSpan.textContent = '0'; sumDiv.textContent = '0,00 ₽';
            errDiv.style.display = val > 0 ? 'block' : 'none'; qrBlock.style.display = 'none';
            return;
        }

        errDiv.style.display = 'none';
        const delta = val - prev;
        const sum = delta * currentTariff;
        deltaSpan.textContent = delta.toFixed(1);
        sumDiv.textContent = formatMoney(sum);
        qrBlock.style.display = 'block';

        const purpose = `${plot.street} ${plot.house}, электроэнергия, показание: ${val}`;
        const qrData = buildPaymentQR(plot, sum, purpose);

        setTimeout(() => {
            const qrTarget = document.getElementById('qr-target');
            if (qrTarget) {
                qrTarget.innerHTML = '';
                const qr = qrcode(0, 'M');
                qr.addData(qrData);
                qr.make();
                qrTarget.innerHTML = qr.createImgTag(5, 5);
                const img = qrTarget.querySelector('img');
                if (img) { img.style.width = '240px'; img.style.height = '240px'; }
                document.getElementById('save-qr-btn').onclick = () => saveQRToGallery('qr-target');
            }
        }, 100);
    };
}

// ─── СБОРКА И СОХРАНЕНИЕ ───
function buildPaymentQR(plot, amount, purpose) {
    const req = appData.settings.requisites || {};
    const encodeValue = (val) => {
        if (!val) return '';
        return encodeURIComponent(String(val).replace(/\|/g, ' ').replace(/=/g, ' ').trim());
    };

    return [
        'ST00012',
        'Name=' + encodeValue(req.name || 'СНТ НАДЕЖДА'),
        'PersonalAcc=' + encodeValue(req.personal_acc || ''),
        'BankName=' + encodeValue(req.bank_name || ''),
        'BIC=' + encodeValue(req.bic || ''),
        'CorrespAcc=' + encodeValue(req.corr_acc || req.corresp_acc || ''),
        'PayeeINN=' + encodeValue(req.inn || ''),
        'KPP=' + encodeValue(req.kpp || ''),
        'Sum=' + Math.round(amount * 100),
        'Purpose=' + encodeValue(purpose)
    ].join('|');
}

function saveQRToGallery(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const img = container.querySelector('img');
    if (!img || !img.src) { alert('QR-код ещё не готов. Подождите секунду.'); return; }

    const a = document.createElement('a');
    a.href = img.src;
    const street = currentPlot.data.street ? currentPlot.data.street.replace(/\s+/g, '_') : 'Участок';
    const house = currentPlot.data.house ? currentPlot.data.house.replace(/\s+/g, '_') : '';
    a.download = `QR_${street}_${house}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ─── ОБРАБОТЧИКИ ШАПКИ ───
document.getElementById('logout-btn').onclick = () => {
    currentPlot = null;
    document.getElementById('password-input').value = '';
    document.getElementById('login-error').textContent = '';
    showScreen('login-screen');
};

document.getElementById('refresh-btn').onclick = () => { loadData(true); };

document.getElementById('info-btn').onclick = () => {
    alert(`Моя дача — СНТ «Надежда»\n\n` + 
          `Веб-версия личного кабинета садовода.\n\n` +
          `Вкладки «Долги», «Платежи» и «Показания» показывают данные из базы СНТ.\n\n` +
          `Вкладка «Электро» отображает баланс кВт·ч.\n\n` +
          `Вкладка «QR» позволяет рассчитать сумму и сформировать QR-код для оплаты взносов или электроэнергии через приложение банка.\n\n` +
          `Если у вас возникли вопросы, обратитесь к председателю СНТ.`);
};

// ─── СТАРТ ───
loadData();
