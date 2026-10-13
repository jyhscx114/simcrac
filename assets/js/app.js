/* 业余无线电台操作技术能力验证 · 刷题与模拟考试系统 */
(function () {
	'use strict';

	/* ============ 考试类别与规则 ============ */
	var CLASSES = {
		A: { key: 'A', name: 'A 类', title: 'A 类操作证书', single: 32, multi: 8, minutes: 40, pass: 30 },
		B: { key: 'B', name: 'B 类', title: 'B 类操作证书', single: 45, multi: 15, minutes: 60, pass: 45 },
		C: { key: 'C', name: 'C 类', title: 'C 类操作证书', single: 70, multi: 20, minutes: 90, pass: 70 }
	};
	var ORDER = ['A', 'B', 'C'];

	function ruleLines(cls) {
		var c = CLASSES[cls];
		return [
			'试卷共 ' + (c.single + c.multi) + ' 题（单选 ' + c.single + ' 题、多选 ' + c.multi + ' 题）',
			'答题时间 ' + c.minutes + ' 分钟',
			'答对 ' + c.pass + ' 题' + (cls === 'C' ? '即为合格' : '及以上合格'),
			'多选题需与标准答案完全一致，多选或少选均不得分'
		];
	}

	/* ============ 基础工具 ============ */
	function $(id) { return document.getElementById(id); }
	function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
	function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
	function pickN(arr, n) { return shuffle(arr.slice()).slice(0, n); }
	function pad2(n) { return (n < 10 ? '0' : '') + n; }
	function mmss(sec) { sec = Math.max(0, sec | 0); return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60); }
	function letters(idxArr) { return idxArr.map(function (i) { return 'ABCD'[i]; }).join(' '); }
	function sameSet(a, b) { return a.length === b.length && a.slice().sort().join(',') === b.slice().sort().join(','); }

	/* 题库存放时正确答案固定排在前面（A/B/C…），显示时按题号做稳定乱序，避免“答案永远是 A”。 */
	function permFor(qi, n) {
		var a = (qi * 2654435761 + 1013904223) >>> 0;
		function rnd() {
			a = (a + 0x6D2B79F5) >>> 0;
			var t = a;
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		}
		var order = [], i;
		for (i = 0; i < n; i++) { order.push(i); }
		for (i = n - 1; i > 0; i--) {
			var j = Math.floor(rnd() * (i + 1)), t = order[i];
			order[i] = order[j]; order[j] = t;
		}
		return order;
	}
	function viewOf(q, qi) {
		var order = permFor(qi, q.o.length);
		return {
			o: order.map(function (k) { return q.o[k]; }),
			a: q.a.map(function (k) { return order.indexOf(k); }).sort(function (x, y) { return x - y; })
		};
	}

	var LS = {
		get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
		set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
		del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
	};

	function getBank(cls) { return (window.BANK && window.BANK[cls]) || []; }

	function wrongAll() { return LS.get('crac_wrong', { A: [], B: [], C: [] }); }
	function markWrong(cls, qi) {
		var w = wrongAll(); w[cls] = w[cls] || [];
		if (w[cls].indexOf(qi) < 0) { w[cls].push(qi); LS.set('crac_wrong', w); }
	}
	function unmarkWrong(cls, qi) {
		var w = wrongAll();
		w[cls] = (w[cls] || []).filter(function (x) { return x !== qi; });
		LS.set('crac_wrong', w);
	}
	function isWrong(cls, qi) { return (wrongAll()[cls] || []).indexOf(qi) >= 0; }

	var toastTimer = null;
	function toast(msg) {
		var el = $('toast');
		el.textContent = msg; el.classList.add('show');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
	}

	/* ============ 视图 ============ */
	var VIEWS = ['home', 'practice', 'exam', 'result', 'wrong'];
	function showView(name) {
		VIEWS.forEach(function (v) { $('view-' + v).classList.toggle('hide', v !== name); });
		window.scrollTo(0, 0);
	}
	function setCrumb(parts) {
		if (!parts || !parts.length) { $('crumb').innerHTML = '&nbsp;'; return; }
		var html = '<a href="javascript:;" data-act="home">题库首页</a>';
		parts.forEach(function (p) {
			html += '<span>/</span>' + esc(p);
		});
		$('crumb').innerHTML = html;
	}

	/* ============ 首页 ============ */
	function bankCount(cls) {
		var bank = getBank(cls), s = 0, m = 0;
		bank.forEach(function (q) { if (q.a.length > 1) { m++; } else { s++; } });
		return { total: bank.length, single: s, multi: m };
	}
	function renderHome() {
		showView('home'); setCrumb('');
		var html = '';
		ORDER.forEach(function (cls) {
			var c = CLASSES[cls], n = bankCount(cls), w = (wrongAll()[cls] || []).length;
			var rules = ruleLines(cls).map(function (t) { return '<li>' + t + '</li>'; }).join('');
			html += '<div class="card ' + cls.toLowerCase() + '">'
				+ '<div class="card-hd"><div class="cls">' + c.name + '操作证书<em>' + c.title + '</em></div></div>'
				+ '<div class="card-bd"><ul class="rule-list">'
				+ '<li>题库共 ' + n.total + ' 题（单选 ' + n.single + ' 题、多选 ' + n.multi + ' 题）</li>'
				+ rules + '</ul></div>'
				+ '<div class="card-ft">'
				+ '<button class="btn" data-act="order" data-cls="' + cls + '">顺序刷题</button>'
				+ '<button class="btn btn-line" data-act="random" data-cls="' + cls + '">随机刷题</button>'
				+ '<button class="btn btn-line" data-act="exam" data-cls="' + cls + '">模拟考试</button>'
				+ '<button class="btn btn-line" data-act="wrong" data-cls="' + cls + '">错题本 (' + w + ')</button>'
				+ '</div></div>';
		});
		$('cards').innerHTML = html;
	}

	/* ============ 刷题 ============ */
	var practice = null;

	function modeTitle(mode) {
		return mode === 'random' ? '随机刷题' : (mode === 'wrong' ? '错题重做' : '顺序刷题');
	}
	function startPractice(cls, mode) {
		var bank = getBank(cls), base;
		if (mode === 'wrong') { base = (wrongAll()[cls] || []).slice(); }
		else { base = bank.map(function (_, i) { return i; }); if (mode === 'random') { base = shuffle(base); } }
		if (!base.length) { toast(mode === 'wrong' ? '错题本还是空的，先去刷题吧' : '题库为空'); return; }
		practice = { cls: cls, mode: mode, base: base, list: base.slice(), pos: 0, sec: '', state: {} };
		showView('practice');
		setCrumb([CLASSES[cls].name + '操作证书', modeTitle(mode)]);
		renderPractice();
	}
	function applyPracticeFilter() {
		var bank = getBank(practice.cls), sec = practice.sec;
		practice.list = sec ? practice.base.filter(function (qi) { return bank[qi].s === sec; }) : practice.base.slice();
		if (practice.pos >= practice.list.length) { practice.pos = Math.max(0, practice.list.length - 1); }
	}
	function practiceAnsweredCount() {
		var n = 0;
		practice.list.forEach(function (qi) { var st = practice.state[qi]; if (st && (st.judged || st.revealed)) { n++; } });
		return n;
	}
	function practiceRate() {
		var r = 0, n = 0;
		practice.list.forEach(function (qi) {
			var st = practice.state[qi];
			if (st && st.judged) { n++; if (st.correct) { r++; } }
		});
		return n ? Math.round(r * 100 / n) + '%' : '-';
	}
	function sectionOptions(cls) {
		var bank = getBank(cls), out = [];
		bank.forEach(function (q) { if (q.s) { out.push(q.s); } });
		var uniq = out.filter(function (v, i) { return out.indexOf(v) === i; }).sort();
		return uniq.map(function (v) { return { v: v, t: v + '（' + countSec(cls, v) + ' 题）' }; });
	}
	function countSec(cls, sec) {
		var n = 0;
		getBank(cls).forEach(function (q) { if (q.s === sec) { n++; } });
		return n;
	}
	function practiceOptHtml(qi, v, i) {
		var st = practice.state[qi] || {};
		var show = st.judged || st.revealed;
		var isCorrect = v.a.indexOf(i) >= 0;
		var isPicked = (st.picked || []).indexOf(i) >= 0;
		var cls = 'opt';
		if (show) { if (isCorrect) { cls += ' right'; } else if (isPicked) { cls += ' wrong'; } }
		else if (isPicked) { cls += ' sel'; }
		return '<div class="' + cls + '" data-opt="' + i + '"><span class="key">' + 'ABCD'[i] + '</span><span class="txt">' + esc(v.o[i]) + '</span></div>';
	}
	function answerBoxHtml(v, picked, correct) {
		return '<div class="analysis ' + (correct ? 'ok' : 'err') + '"><b>' + (correct ? '回答正确' : '回答错误') + '</b>　正确答案：<b>'
			+ letters(v.a) + '</b>' + (correct ? '' : '　你的作答：<b>' + (picked && picked.length ? letters(picked) : '未作答') + '</b>') + '</div>';
	}
	function renderPractice() {
		var bank = getBank(practice.cls);
		if (!practice.list.length) { toast('该章节暂无题目'); practice.sec = ''; applyPracticeFilter(); }
		var total = practice.list.length;
		var qi = practice.list[practice.pos];
		if (qi === undefined) { return; }
		var q = bank[qi], v = viewOf(q, qi);
		var st = practice.state[qi] || {};
		var isMulti = q.a.length > 1;
		var secSel = '<select class="sel-inp" data-p="sec"><option value="">全部章节</option>'
			+ sectionOptions(practice.cls).map(function (o) {
				return '<option value="' + esc(o.v) + '"' + (o.v === practice.sec ? ' selected' : '') + '>' + esc(o.t) + '</option>';
			}).join('') + '</select>';

		$('practice-main').innerHTML = ''
			+ '<div class="qhead">'
			+ '<div class="left"><span class="qtype' + (isMulti ? ' multi' : '') + '">' + (isMulti ? '多选题' : '单选题') + '</span>'
			+ '<span>第 <b>' + (practice.pos + 1) + '</b> / ' + total + ' 题</span>'
			+ (q.s ? '<span class="tag">章节 ' + esc(q.s) + '</span>' : '') + '</div>'
			+ '<div class="left">' + secSel + '</div></div>'
			+ '<div class="q-body">' + esc(q.q) + '</div>'
			+ (q.f ? '<div class="q-fig"><img src="assets/figs/' + esc(q.f) + '" alt="题图"></div>' : '')
			+ '<div class="opts">' + v.o.map(function (_, i) { return practiceOptHtml(qi, v, i); }).join('') + '</div>'
			+ (st.judged ? answerBoxHtml(v, st.picked, st.correct) : (st.revealed ? '<div class="analysis ok">正确答案：<b>' + letters(v.a) + '</b></div>' : ''))
			+ '<div class="actions">'
			+ '<button class="btn btn-line" data-p="prev"' + (practice.pos === 0 ? ' disabled' : '') + '>上一题</button>'
			+ (isMulti && !st.judged && !st.revealed ? '<button class="btn" data-p="submit">提交答案</button>' : '')
			+ (!st.judged && !st.revealed ? '<button class="btn btn-grey" data-p="reveal">显示答案</button>' : '')
			+ '<button class="btn btn-line" data-p="next"' + (practice.pos >= total - 1 ? ' disabled' : '') + '>下一题</button>'
			+ '<span class="spacer"></span>'
			+ '<span class="txt-grey">已答 ' + practiceAnsweredCount() + ' / ' + total + '　正确率 ' + practiceRate() + '</span>'
			+ (isWrong(practice.cls, qi) ? '<button class="btn btn-line btn-sm" data-p="unwrong">移出错题本</button>' : '')
			+ '</div>';
		$('practice-sheet').innerHTML = sheetHtml('practice');
	}

	/* ============ 答题卡 ============ */
	function sheetHtml(kind) {
		var bank, list, pos, cellClass, title, note, legend;
		if (kind === 'practice') {
			bank = getBank(practice.cls); list = practice.list; pos = practice.pos;
			title = modeTitle(practice.mode) + ' · ' + CLASSES[practice.cls].name;
			note = '点击题号跳转';
			cellClass = function (qi) {
				var st = practice.state[qi] || {}, c = 'cell';
				if (st.judged) { c += st.correct ? ' right' : ' wrong'; }
				else if (st.revealed) { c += ' done'; }
				return c;
			};
			legend = '<div class="legend"><span><i class="c-now"></i>当前</span><span><i class="c-right"></i>答对</span><span><i class="c-wrong"></i>答错</span><span><i class="c-done"></i>已看</span></div>';
		} else {
			bank = getBank(exam.cls); list = exam.list; pos = exam.pos;
			title = '答题卡 · ' + CLASSES[exam.cls].name;
			note = '已答 ' + examAnsweredCount() + ' / ' + list.length;
			cellClass = function (qi, i) { return 'cell' + ((exam.answers[i] || []).length ? ' done' : ''); };
			legend = '<div class="legend"><span><i class="c-now"></i>当前</span><span><i class="c-done"></i>已作答</span></div>';
		}
		var cells = list.map(function (qi, i) {
			var mk = bank[qi].a.length > 1 ? '<span class="mk">多</span>' : '';
			return '<div class="' + cellClass(qi, i) + (i === pos ? ' cur' : '') + '" data-jump="' + i + '">' + (i + 1) + mk + '</div>';
		}).join('');
		return '<h3><span>' + esc(title) + '</span><span class="txt-grey">' + note + '</span></h3>' + legend + '<div class="grid">' + cells + '</div>';
	}

	/* ============ 模拟考试 ============ */
	var exam = null, examTimer = null;

	function startExam(cls) {
		var c = CLASSES[cls], bank = getBank(cls), singles = [], multis = [];
		bank.forEach(function (q, i) { (q.a.length > 1 ? multis : singles).push(i); });
		if (singles.length < c.single || multis.length < c.multi) { toast('题库题量不足，无法组卷'); return; }
		exam = {
			cls: cls, cfg: c,
			list: pickN(singles, c.single).concat(pickN(multis, c.multi)),
			answers: {}, pos: 0, remain: c.minutes * 60, total: c.minutes * 60,
			startAt: Date.now(), submitted: false
		};
		showView('exam');
		setCrumb([CLASSES[cls].name + '操作证书', '模拟考试']);
		renderExam();
		clearInterval(examTimer);
		examTimer = setInterval(function () {
			if (!exam || exam.submitted) { return; }
			exam.remain--;
			updateTimer();
			if (exam.remain <= 0) { submitExam(true); }
		}, 1000);
	}
	function updateTimer() {
		var el = $('exam-timer');
		if (!el) { return; }
		el.textContent = mmss(exam.remain);
		el.classList.toggle('warn', exam.remain <= 300);
	}
	function examAnsweredCount() {
		var n = 0;
		exam.list.forEach(function (_, i) { var a = exam.answers[i]; if (a && a.length) { n++; } });
		return n;
	}
	function renderExam() {
		var q = getBank(exam.cls)[exam.list[exam.pos]];
		var qi = exam.list[exam.pos];
		var v = viewOf(q, qi), isMulti = q.a.length > 1, picked = exam.answers[exam.pos] || [];

		$('exam-bar').innerHTML = '<div class="meta">'
			+ '<span>类别：<b>' + CLASSES[exam.cls].name + '</b></span>'
			+ '<span>题量：<b>' + exam.list.length + '</b> 题（单选 ' + exam.cfg.single + ' / 多选 ' + exam.cfg.multi + '）</span>'
			+ '<span>已答：<b id="exam-done">' + examAnsweredCount() + '</b>/' + exam.list.length + '</span>'
			+ '<span>合格线：<b>' + exam.cfg.pass + '</b> 题</span></div>'
			+ '<div class="meta"><span class="txt-grey">剩余时间</span><span class="timer" id="exam-timer">' + mmss(exam.remain) + '</span>'
			+ '<button class="btn" data-e="submit">交卷</button></div>';

		$('exam-main').innerHTML = ''
			+ '<div class="qhead"><div class="left">'
			+ '<span class="qtype' + (isMulti ? ' multi' : '') + '">' + (isMulti ? '多选题' : '单选题') + '</span>'
			+ '<span>第 <b>' + (exam.pos + 1) + '</b> / ' + exam.list.length + ' 题</span>'
			+ (q.s ? '<span class="tag">章节 ' + esc(q.s) + '</span>' : '') + '</div></div>'
			+ '<div class="q-body">' + esc(q.q) + '</div>'
			+ (q.f ? '<div class="q-fig"><img src="assets/figs/' + esc(q.f) + '" alt="题图"></div>' : '')
			+ '<div class="opts">' + v.o.map(function (_, i) {
				return '<div class="opt' + (picked.indexOf(i) >= 0 ? ' sel' : '') + '" data-opt="' + i + '">'
					+ '<span class="key">' + 'ABCD'[i] + '</span><span class="txt">' + esc(v.o[i]) + '</span></div>';
			}).join('') + '</div>'
			+ '<div class="actions">'
			+ '<button class="btn btn-line" data-e="prev"' + (exam.pos === 0 ? ' disabled' : '') + '>上一题</button>'
			+ '<button class="btn btn-line" data-e="next"' + (exam.pos >= exam.list.length - 1 ? ' disabled' : '') + '>下一题</button>'
			+ '<span class="spacer"></span>'
			+ (isMulti ? '<span class="txt-grey">多选题：需与标准答案完全一致，多选或少选均不得分</span>' : '')
			+ '</div>';
		$('exam-sheet').innerHTML = sheetHtml('exam');
	}
	function submitExam(auto) {
		if (!exam || exam.submitted) { return; }
		var un = exam.list.length - examAnsweredCount();
		if (!auto && !window.confirm(un > 0 ? ('还有 ' + un + ' 题未作答，确定交卷吗？') : '确定交卷吗？')) { return; }
		exam.submitted = true;
		clearInterval(examTimer);
		gradeAndShow();
	}

	var lastResult = null;
	function gradeAndShow() {
		var bank = getBank(exam.cls);
		var right = 0, sR = 0, sW = 0, mR = 0, mW = 0, wrongItems = [];
		exam.list.forEach(function (qi, pos) {
			var q = bank[qi], v = viewOf(q, qi), picked = (exam.answers[pos] || []).slice();
			var isMulti = q.a.length > 1;
			if (sameSet(picked, v.a)) { right++; if (isMulti) { mR++; } else { sR++; } }
			else {
				if (isMulti) { mW++; } else { sW++; }
				wrongItems.push({ qi: qi, picked: picked });
				markWrong(exam.cls, qi);
			}
		});
		var c = exam.cfg;
		lastResult = {
			cls: exam.cls, right: right, total: exam.list.length, pass: c.pass,
			passed: right >= c.pass, used: Math.min(exam.total, Math.round((Date.now() - exam.startAt) / 1000)),
			sR: sR, sW: sW, mR: mR, mW: mW, wrongItems: wrongItems, blank: exam.list.length - examAnsweredCount()
		};
		renderResult();
	}
	function stat(n, l) { return '<div class="stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; }
	function renderResult() {
		showView('result');
		setCrumb([CLASSES[lastResult.cls].name + '操作证书', '模拟考试成绩']);
		var r = lastResult, bank = getBank(r.cls);
		var color = r.passed ? '#00a870' : '#e34d59';
		var html = '<div class="panel"><div class="result-hero">'
			+ '<div class="score" style="color:' + color + '">' + r.right + '<small> / ' + r.total + ' 题</small></div>'
			+ '<div class="verdict ' + (r.passed ? 'pass' : 'fail') + '">' + (r.passed ? '合格' : '不合格') + '</div>'
			+ '<p class="txt-grey" style="margin-top:14px">' + CLASSES[r.cls].name + '操作证书 · 合格线 ' + r.pass
			+ ' 题 · 用时 ' + mmss(r.used) + (r.blank ? ' · 未作答 ' + r.blank + ' 题' : '') + '</p></div>'
			+ '<div class="stat-row">'
			+ stat(r.right, '答对')
			+ stat(r.wrongItems.length - r.blank, '答错')
			+ stat(r.sR + ' / ' + (r.sR + r.sW), '单选 对/总')
			+ stat(r.mR + ' / ' + (r.mR + r.mW), '多选 对/总')
			+ '</div>'
			+ '<div class="actions">'
			+ '<button class="btn" data-act="exam" data-cls="' + r.cls + '">再考一次</button>'
			+ '<button class="btn btn-line" data-act="home">返回题库首页</button>'
			+ (r.wrongItems.length ? '<button class="btn btn-line" data-act="wrong" data-cls="' + r.cls + '">查看错题本</button>' : '')
			+ '</div>';
		html += '<div class="section-title">错题回顾<span class="r">共 ' + r.wrongItems.length + ' 题</span></div>';
		if (r.wrongItems.length) {
			r.wrongItems.forEach(function (it, n) { html += wrongItemHtml(bank[it.qi], it.qi, n + 1, it.picked); });
		} else {
			html += '<div class="empty">全部答对，太棒了！</div>';
		}
		$('view-result').innerHTML = html + '</div>';
	}
	function wrongItemHtml(q, qi, no, picked) {
		var v = viewOf(q, qi);
		return '<div class="wrong-item">'
			+ '<div class="wt">' + no + '. ' + esc(q.q) + (q.s ? ' <span class="tag">章节 ' + esc(q.s) + '</span>' : '') + '</div>'
			+ (q.f ? '<div class="q-fig"><img src="assets/figs/' + esc(q.f) + '" alt="题图"></div>' : '')
			+ (picked ? '<div class="wl" style="color:#8b93a5">你的作答：' + (picked.length ? letters(picked) : '未作答')
				+ '　正确答案：<b style="color:#00a870">' + letters(v.a) + '</b></div>' : '')
			+ v.o.map(function (t, i) {
				var isC = v.a.indexOf(i) >= 0, isP = (picked || []).indexOf(i) >= 0;
				var style = isC ? ' style="color:#00a870;font-weight:600"' : (isP ? ' style="color:#e34d59;text-decoration:line-through"' : '');
				return '<div class="wl"' + style + '>' + 'ABCD'[i] + '. ' + esc(t)
					+ (isC ? '　<b>√ 正确答案</b>' : (isP ? '　<em>× 你的选择</em>' : '')) + '</div>';
			}).join('')
			+ '</div>';
	}

	/* ============ 错题本 ============ */
	var wrongTab = 'A';
	function renderWrongBook(cls) {
		if (cls) { wrongTab = cls; }
		showView('wrong');
		setCrumb(['错题本']);
		var w = wrongAll(), bank = getBank(wrongTab), list = w[wrongTab] || [];
		var tabs = ORDER.map(function (k) {
			return '<a href="javascript:;" class="tab' + (k === wrongTab ? ' on' : '') + '" data-act="wrong-tab" data-cls="' + k + '">'
				+ CLASSES[k].name + '（' + ((w[k] || []).length) + '）</a>';
		}).join('');
		var body = list.length
			? list.map(function (qi, n) { return wrongItemHtml(bank[qi], qi, n + 1, null); }).join('')
			: '<div class="empty">' + CLASSES[wrongTab].name + '错题本暂无题目<br><span class="txt-grey">刷题或模拟考试中的错题会自动收录到这里</span></div>';
		$('view-wrong').innerHTML = '<div class="panel"><div class="tabs">' + tabs + '</div>'
			+ '<div class="filters" style="margin-bottom:16px">'
			+ '<button class="btn" data-act="wrong-redo" data-cls="' + wrongTab + '"' + (list.length ? '' : ' disabled') + '>开始重做（' + list.length + ' 题）</button>'
			+ '<button class="btn btn-grey" data-act="wrong-clear" data-cls="' + wrongTab + '"' + (list.length ? '' : ' disabled') + '>清空本类错题</button>'
			+ '<span class="txt-grey">错题按类别分别记录，重做时答对可自动移出</span></div>' + body + '</div>';
	}

	/* ============ 交互 ============ */
	function setPracticePos(p) {
		if (p < 0 || p >= practice.list.length) { return; }
		practice.pos = p;
		renderPractice();
	}
	function judgePractice(qi, picked) {
		var q = getBank(practice.cls)[qi], ok = sameSet(picked, viewOf(q, qi).a);
		practice.state[qi] = { picked: picked, judged: true, correct: ok };
		if (ok) { unmarkWrong(practice.cls, qi); } else { markWrong(practice.cls, qi); }
	}
	function clickPracticeOption(i) {
		var qi = practice.list[practice.pos], q = getBank(practice.cls)[qi];
		var st = practice.state[qi] || { picked: [] };
		if (st.judged || st.revealed) { return; }
		if (q.a.length > 1) {
			var picked = (st.picked || []).slice(), k = picked.indexOf(i);
			if (k >= 0) { picked.splice(k, 1); } else { picked.push(i); }
			practice.state[qi] = { picked: picked, judged: false };
			renderPractice();
		} else {
			judgePractice(qi, [i]);
			renderPractice();
		}
	}
	function submitPractice() {
		var qi = practice.list[practice.pos], st = practice.state[qi] || {};
		if (!(st.picked || []).length) { toast('请先选择答案'); return; }
		judgePractice(qi, st.picked);
		renderPractice();
	}
	function revealPractice() {
		var qi = practice.list[practice.pos], st = practice.state[qi] || {};
		st.revealed = true;
		practice.state[qi] = st;
		renderPractice();
	}
	function toggleExamOption(i) {
		var q = getBank(exam.cls)[exam.list[exam.pos]];
		var picked = (exam.answers[exam.pos] || []).slice();
		if (q.a.length > 1) {
			var k = picked.indexOf(i);
			if (k >= 0) { picked.splice(k, 1); } else { picked.push(i); }
		} else {
			picked = (picked.length === 1 && picked[0] === i) ? [] : [i];
		}
		exam.answers[exam.pos] = picked;
		renderExam();
	}

	document.addEventListener('click', function (e) {
		var t = e.target.closest ? e.target.closest('[data-act],[data-p],[data-e],[data-opt],[data-jump]') : null;
		if (!t) { return; }
		var inPractice = !$('view-practice').classList.contains('hide');
		var inExam = !$('view-exam').classList.contains('hide');

		if (t.hasAttribute('data-act')) {
			var act = t.getAttribute('data-act'), cls = t.getAttribute('data-cls');
			if (act === 'home') { renderHome(); }
			else if (act === 'order') { startPractice(cls, 'order'); }
			else if (act === 'random') { startPractice(cls, 'random'); }
			else if (act === 'exam') { startExam(cls); }
			else if (act === 'wrong' || act === 'wrong-tab') { renderWrongBook(cls); }
			else if (act === 'wrong-redo') { startPractice(cls, 'wrong'); }
			else if (act === 'wrong-clear' && window.confirm('确定清空 ' + CLASSES[cls].name + ' 的全部错题吗？')) {
				var w = wrongAll(); w[cls] = []; LS.set('crac_wrong', w); renderWrongBook(cls);
			}
			return;
		}
		if (t.hasAttribute('data-jump')) {
			var idx = parseInt(t.getAttribute('data-jump'), 10);
			if (inPractice) { setPracticePos(idx); } else if (inExam) { exam.pos = idx; renderExam(); }
			return;
		}
		if (t.hasAttribute('data-opt')) {
			var oi = parseInt(t.getAttribute('data-opt'), 10);
			if (inPractice) { clickPracticeOption(oi); } else if (inExam) { toggleExamOption(oi); }
			return;
		}
		if (t.hasAttribute('data-p')) {
			var p = t.getAttribute('data-p');
			if (p === 'prev') { setPracticePos(practice.pos - 1); }
			else if (p === 'next') { setPracticePos(practice.pos + 1); }
			else if (p === 'submit') { submitPractice(); }
			else if (p === 'reveal') { revealPractice(); }
			else if (p === 'unwrong') { unmarkWrong(practice.cls, practice.list[practice.pos]); renderPractice(); toast('已移出错题本'); }
			return;
		}
		if (t.hasAttribute('data-e')) {
			var k = t.getAttribute('data-e');
			if (k === 'prev') { exam.pos = Math.max(0, exam.pos - 1); renderExam(); }
			else if (k === 'next') { exam.pos = Math.min(exam.list.length - 1, exam.pos + 1); renderExam(); }
			else if (k === 'submit') { submitExam(false); }
		}
	});

	document.addEventListener('change', function (e) {
		var t = e.target;
		if (t.hasAttribute && t.getAttribute('data-p') === 'sec') {
			practice.sec = t.value; practice.pos = 0; applyPracticeFilter(); renderPractice();
		}
	});

	document.addEventListener('keydown', function (e) {
		if (!$('view-practice').classList.contains('hide') && practice) {
			if (e.key === 'ArrowLeft') { setPracticePos(practice.pos - 1); }
			else if (e.key === 'ArrowRight') { setPracticePos(practice.pos + 1); }
			else if ('1234'.indexOf(e.key) >= 0) { clickPracticeOption(parseInt(e.key, 10) - 1); }
		} else if (!$('view-exam').classList.contains('hide') && exam) {
			if (e.key === 'ArrowLeft') { exam.pos = Math.max(0, exam.pos - 1); renderExam(); }
			else if (e.key === 'ArrowRight') { exam.pos = Math.min(exam.list.length - 1, exam.pos + 1); renderExam(); }
		}
	});

	/* ============ 启动 ============ */
	function boot() {
		if (!window.BANK || !window.BANK.A || !window.BANK.B || !window.BANK.C) {
			document.querySelector('.page').innerHTML = '<div class="panel"><div class="empty">题库数据加载失败，请确认 data 目录下的 bank_a.js / bank_b.js / bank_c.js 是否存在。</div></div>';
			return;
		}
		var user = LS.get('crac_user', null);
		if (!user) { location.replace('index.html'); return; }
		$('user-name').textContent = user.name || user.acc || '考生';
		$('btn-logout').addEventListener('click', function () { LS.del('crac_user'); location.href = 'index.html'; });
		$('btn-home').addEventListener('click', renderHome);
		window.addEventListener('beforeunload', function () { clearInterval(examTimer); });
		renderHome();
	}
	boot();
})();
