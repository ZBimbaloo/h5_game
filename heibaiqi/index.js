"use strict";

function Chessboard()
{
	var oo = this;

	var pieces;		//棋子元素
	var piecesnum;	//黑白子数目显示元素
	var side;	//表示执棋方元素

	oo.toDown = null;	//下子

	function bindEvent(td)	//绑定点击事件
	{
		for(var i=0; i<64; i++)
			(function (i){
				td[i].onclick = function (){
					if (pieces[i].className=="prompt")
						oo.toDown(i);
				}
			})(i);
		td = undefined;
	}

	oo.create = function ()		//创建棋盘
	{
		var obj = document.getElementById("chessboard");
		var html = "<table>";
		for (var i=0; i<8; i++)
		{
			html += "<tr>";
			for (var j=0; j<8; j++)
				html += "<td class='bg"+(j+i)%2+"'><div></div></td>";
			html += "</tr>";
		}
		html += "</table>";
		obj.innerHTML = html;
		pieces = obj.getElementsByTagName("div");
		bindEvent(obj.getElementsByTagName("td"));

		piecesnum = document.getElementById("console").getElementsByTagName("span");
		side = {
			"1": document.getElementById("side1"),
			"-1": document.getElementById("side2")
		};
	}

	oo.update = function (m,nop)		//更新棋盘
	{
		for (var i=0; i<64; i++)
			pieces[i].className = ["white","","black"][m[i]+1];
		if (!nop)
			for (var n in m.next)
				pieces[n].className = "prompt";
		for (var i=0; i<m.newRev.length; i++)
			pieces[m.newRev[i]].className += " reversal";
		if (m.newPos!=-1)
			pieces[m.newPos].className += " newest";
		piecesnum[0].innerHTML = m.black;
		piecesnum[1].innerHTML = m.white;
		side[m.side].className = "cbox side";
		side[-m.side].className = "cbox";
	}
}


function AI()
{
	var oo = this;

	oo.calculateTime = 1000;	//限制每步棋计算的时间
	oo.outcomeDepth = 14;		//终局搜索深度
	var outcomeCoarse = 15;		//终局搜索模糊模式搜索深度
	var maxDepth;
	var outTime;

	var weight = [6,11,2,2,3];  //权重

	var rnd = [			//用于估价函数中边角的计算
		{s: 0,a: 1,b: 8,c: 9,dr:[1,8]},
		{s: 7,a: 6,b:15,c:14,dr:[-1,8]},
		{s:56,a:57,b:48,c:49,dr:[1,-8]},
		{s:63,a:62,b:55,c:54,dr:[-1,-8]}
	];

	oo.history = [[],[]];			//历史启发表
	for (var i=0; i<2; i++)
		for (var j=0; j<=60; j++)
			oo.history[i][j] = [0,63,7,56,37,26,20,43,19,29,34,44,21,42,45,18,2,61,23,40,5,58,47,16,10,53,22,41,13,46,17,50,51,52,12,11,30,38,25,33,4,3,59,60,39,31,24,32,1,62,15,48,8,55,6,57,9,54,14,49];

	var hash = new Transposition();

	function sgn(n)//符号函数，要用时才发现javascript居然没有sgn函数，真晕啊
	{
		return n>0?1:n<0?-1:0;
	}


	function evaluation(m)			//估价函数
	{
		var corner = 0, steady = 0, uk = {};
		for (var i=0,v,l = rnd.length; v = rnd[i],i<l; i++)
		{
			if (m[v.s]==0)			//角为空格
			{
				corner += m[v.a] * -3;		//次要危险点
				corner += m[v.b] * -3;		//次要危险点
				corner += m[v.c] * -6;		//主要危险点
				continue;
			}
			corner += m[v.s] * 15;		//角点
			steady += m[v.s];		//角也是稳定子
			for (var k = 0; k <2; k++)
			{
				if (uk[v.s+v.dr[k]])
					continue;
				var eb = true, tmp = 0;
				for (var j = 1; j <= 6; j++)
				{
					var t = m[v.s+v.dr[k]*j];
					if (t==0)
							break;
					else if (eb && t==m[v.s])
						steady += t;		//稳定子
					else
					{
						eb = false;
						tmp += t;		//稳定子
					}
				}
				if (j==7 && m[v.s+v.dr[k]*7]!=0)
				{
					steady += tmp;
					uk[v.s+v.dr[k]*6] = true;
				}
			}
		}

		var frontier = 0;		//前沿子
		for (var i=9; i<=54; i+=(i&7)==6?3:1)
		{
			if (m[i]==0)
				continue;
			for (var j=0; j<8; j++)
				if (m[othe.dire(i,j)]==0)
				{
					frontier -= m[i];
					break;
				}
		}

		var mobility = (m.nextNum-m.prevNum)*m.side;	//行动力(简单吧)

		var parity = m.space<18 ? (m.space%2==0?-m.side:m.side) : 0;	//奇偶性


		var rv = corner*weight[0] + steady*weight[1] + frontier*weight[2] + mobility*weight[3] + parity*weight[4];
		return rv * m.side;
	}

	function outcome(m)		//终局结果
	{
		var s = m.black-m.white;
		if (maxDepth>=outcomeCoarse)
			return sgn(s)*10000*m.side;//为了加快终局搜索速度只给出输赢,暂不记分,使搜索更容易发生剪枝.
		return (s+m.space*sgn(s))*10000*m.side;
	}

	oo.startSearch = function(m)		//开始搜索博弈树
	{
		// hash = new Transposition();
		// console.profile('性能分析器一');
		var f = 0;
		if (m.space<=oo.outcomeDepth)
		{
			//进行终局搜索
			outTime = (new Date()).getTime()+600000;		//终局搜索就不限时间了
			maxDepth = m.space;
			//console.time("计时器2");
			if (maxDepth>=outcomeCoarse)
				f = alphaBeta(m, maxDepth, -Infinity, Infinity);
			else
				f = mtd(m, maxDepth, f);
			//console.timeEnd("计时器2");
			console.log("终局搜索结果：",maxDepth,m.space,m.side,f*m.side);
			return hash.getBest(m.key);
		}

		outTime = (new Date()).getTime()+oo.calculateTime;
		maxDepth = 0;
		//console.time("计时器2");
		try {
			while (maxDepth<m.space)
			{
				f = mtd(m, ++maxDepth, f);
				// f = alphaBeta(m, ++maxDepth, -Infinity, Infinity);
				var best = hash.getBest(m.key);
				console.log(maxDepth,f*m.side,best);
			}
		} catch(eo){
			if (eo.message!="time out")		//不有限定计算时间的异常
				throw eo;					//把异常转抛给浏览器
		}
		//console.timeEnd("计时器2");
		// console.profileEnd();
		console.log("搜索结果：",maxDepth-1,m.space,m.side,f*m.side);
		return best;
	}

	function mtd(m,depth,f)		//MTD(f)算法
	{
		var lower = -Infinity;
		var upper = Infinity;
		do {
			var beta = (f==lower) ? f+1 : f;	// 确定试探值
			f = alphaBeta(m, depth, beta-1, beta);	// 进行零宽窗口试探
			if (f < beta)
				upper = f;
			else
				lower = f;
		} while (lower < upper);
		if (f < beta)	// 如果最后一次搜索得到的只是上限，需再搜索一次，确保获得正确的最佳棋步
			f = alphaBeta(m, depth, f-1, f);
		return f;
	}

	function alphaBeta(m,depth,alpha,beta)		//Alpha-beta剪枝
	{
		if ((new Date()).getTime() > outTime)		//判断是否到达限定的计算时间
			throw new Error("time out");		//用抛出异常方式直接从深层搜索中跳出来

		var hv = hash.get(m.key,depth,alpha,beta);
		if (hv !== false)
			return hv;

		if (m.space==0)			//棋盘子满
			return outcome(m);	//直接返回终局结果
		othe.findLocation(m);
		if (m.nextNum==0)		//判断无棋可走
		{
			if (m.prevNum==0)		//判断上一步也是无棋可走
				return outcome(m);		//直接返回终局结果
			othe.pass(m);
			return -alphaBeta(m, depth, -beta, -alpha);
		}
		if (depth<=0)			//搜索深度到达设置的极限
		{
			var e = evaluation(m);
			hash.set(m.key,e,depth,0,null);
			return e;
		}

		var hd = hash.getBest(m.key);
		if (hd!==null)
			moveToHead(m.nextIndex,hd);

		var hist = oo.history[m.side==1?0:1][m.space];
		var hashf = 1;				//最佳估值类型, 0为精确值, 1为<=alpha, 2为>=beta
		var bestVal = -Infinity;		//记录最佳估值
		var bestAct = null;				//记录最佳棋步
		for (var i=0; i<m.nextNum; i++)
		{
			var n = m.nextIndex[i];
			var v = -alphaBeta(othe.newMap(m,n), depth-1, -beta, -alpha);
			if (v > bestVal)
			{
				bestVal = v;
				bestAct = n;
				if (v > alpha)
				{
					alpha = v;
					hashf = 0;
					moveToUp(hist,n);
				}
				if (v >= beta)
				{
					hashf = 2;
					break;		//发生剪枝
				}
			}
		}
		moveToHead(hist,bestAct);
		hash.set(m.key,bestVal,depth,hashf,bestAct);
		return bestVal;
	}

	function moveToHead(arr,n)
	{
		if (arr[0]==n)
			return;
		var i = arr.indexOf(n);
		arr.splice(i,1);
		arr.unshift(n);
	}

	function moveToUp(arr,n)
	{
		if (arr[0]==n)
			return;
		var i = arr.indexOf(n);
		arr[i] = arr[i-1];
		arr[i-1] = n;
	}

}




function Transposition()
{
	var oo = this;

	var HASH_SIZE = (1 << 19) -1;		//置换单元数为 524287
	var data = new Array(HASH_SIZE+1);

	oo.set = function (key,eva,depth,flags,best)
	{
		var keyb = key[0]&HASH_SIZE;
		var phashe = data[keyb];
		if (!phashe)
			phashe = data[keyb] = {};
		else if (phashe.key == key[1] && phashe.depth > depth)		//局面相同 并且 记录比当前更深 则不替换
			return;
		phashe.key = key[1];
		phashe.eva = eva;
		phashe.depth = depth;
		phashe.flags = flags;
		phashe.best = best;
	}

	oo.get = function (key,depth,alpha,beta)
	{
		var phashe = data[key[0]&HASH_SIZE];
		if ((!phashe) || phashe.key != key[1] || phashe.depth < depth)
			return false;
		switch (phashe.flags)
		{
			case 0:
				return phashe.eva;
			case 1:
				if (phashe.eva <= alpha)
					return phashe.eva;
				return false;
			case 2:
				if (phashe.eva >= beta)
					return phashe.eva;
				return false;
		}
	}

	oo.getBest = function (key)
	{
		var phashe = data[key[0]&HASH_SIZE];
		if ((!phashe) || phashe.key != key[1])
			return null;
		return phashe.best;
	}


}


function Zobrist()
{
	var oo = this;

	var swapSide = [rnd(),rnd()];// 下棋方轮换的附加散列码
	var zarr = [[],[],[]];
	for (var pn=0; pn<64; pn++)
	{
		zarr[0][pn] = [rnd(),rnd()];// 各位置上出现黑棋时
		zarr[1][pn] = [rnd(),rnd()];// 各位置上出现白棋时
		zarr[2][pn] = [zarr[0][pn][0]^zarr[1][pn][0], zarr[0][pn][1]^zarr[1][pn][1]];// 各位置上翻棋时
	}

	function rnd()		//获取32位的随机数
	{
		return (Math.random()*0x100000000)>>0;
	}

	oo.swap = function (key)		//执棋方轮换
	{
		key[0] ^= swapSide[0];
		key[1] ^= swapSide[1];
	}

	oo.set = function (key,pc,pn)	//设置更新key
	{
		key[0] ^= zarr[pc][pn][0];
		key[1] ^= zarr[pc][pn][1];
	}
}



function Othello()
{
	var oo = this;

	var map = [];			//棋局数组
	var history = [];		//历史记录,用于悔棋操作

	var zobrist = new Zobrist();

	oo.aiSide = 0;	//1: 电脑为黑棋,  -1: 电脑为白棋,  0: 双人对战 2: 电脑自己对战


	var aiRuning = false;	//AI运算中...
	var aiRuningObj = document.getElementById("airuning");
	var passObj = document.getElementById("pass");

	var timer;		//定时器id

	oo.play = function ()	//开始新棋局
	{
		if (aiRuning)
			return;
		clearTimeout(timer);
		console.clear();
		//console.time("计时器1");
		map = [];
		for (var i=0; i<64; i++)
			map[i] = 0;					//空格为 0
		map[28] = map[35] = 1;			//黑子为 1
		map[27] = map[36] = -1;			//白子为 -1
		map.black = map.white = 2;		//黑白棋子数目
		map.space = 60;		//空格数目
		map.frontier = [];	//周围有棋子的空格，用于加速查找可下棋步
		var tk = [18,19,20,21,26,29,34,37,42,43,44,45];
		for (var i=0; i<12; i++)
			map.frontier[tk[i]] = true;
		map.side = 1;		//当前执棋方
		map.newPos = -1;	//最新下子的位置
		map.newRev = [];	//最新反转棋子的位置
		map.nextIndex = [];	//下一步可走棋的位置
		map.next = {};		//下一步可走棋的反转棋子
		map.nextNum = 0;	//下一步可走棋的数目
		map.prevNum = 0;	//上一步可走棋的数目
		map.key = [0,0];	//用于置换表的键值
		history = [];
		update();
	}

	function update()	//
	{
		var aiAuto = oo.aiSide==map.side || oo.aiSide==2;
		oo.findLocation(map);
		setAIRunStatus(false);
		setPassStatus(false);
		board.update(map,aiAuto);
		// console.log(map.nextIndex)

		if (map.space==0 || map.nextNum==0 && map.prevNum==0)		//棋盘子满 或 双方都无棋可走
		{
			timer = setTimeout(gameOver, 450);
			return;
		}
		if (map.nextNum==0)	//无棋可走pass
		{
			timer = setTimeout(function() {
				oo.pass(map);
				update();
				setPassStatus(true);
			}, 450);
			return;
		}
		if (aiAuto)
		{
			aiRuning = true;
			timer = setTimeout(function () {
				setAIRunStatus(true);
				timer = setTimeout(aiRun, 50);
			}, 400);
		}
	}

	function aiRun()		//电脑走棋
	{
		if (map.nextNum==1)	//就一步棋可走了,还搜索什么?
			oo.go(map.nextIndex[0]);
		else if (map.space<=58)
			oo.go(ai.startSearch(map));
		else
			oo.go(map.nextIndex[Math.random()*map.nextIndex.length>>0]);
	}
	// document.getElementById("ai").onclick = aiRun;

	function gameOver()
	{
		// console.timeEnd("计时器1");
		setAIRunStatus(false);
		setPassStatus(false);
		alert("棋局结束\n\n黑棋: "+map.black+" 子\n白棋: "+map.white+" 子\n\n"+(map.black==map.white?"平局!!!":map.black>map.white?"黑棋胜利!!!":"白棋胜利!!!"));
	}

	oo.dire = (function(){				//获取某一棋盘格某一方向的格子.超过边界返回64
		var dr = [-8,-7,1,9,8,7,-1,-9];
		var bk = [8,0,0,0,8,7,7,7];
		return function(i,d)
		{
			i += dr[d];
			return (i&64)!=0 || (i&7)==bk[d] ? 64 : i;
		}
	})();

	oo.findLocation = function (m)		//查找可走棋的位置
	{
		function is(i,j)
		{
			var lk = 0;
			while ((i=oo.dire(i,j))!=64 && m[i]==-m.side)
			{
				ta[la++] = i;
				lk++;
			}
			if(i==64 || m[i]!=m.side)
				la -= lk;
		}
		m.nextIndex = [];
		m.next = [];
		var hist = ai.history[m.side==1?0:1][m.space];
		for(var i=0; i<60; i++)
		{
			var fi = hist[i];
			if (!m.frontier[fi])
				continue;
			var ta = [], la = 0;
			for (var j=0; j<8; j++)
				is(fi,j);
			if (la>0)
			{
				if (la!=ta.length)
				 	ta = ta.slice(0, la);
				m.next[fi] = ta;
				m.nextIndex.push(fi);
			}
		}
		m.nextNum = m.nextIndex.length;
	}

	oo.pass = function(m)			//一方无棋可走
	{
		m.side = -m.side;
		m.prevNum = m.nextNum;
		zobrist.swap(m.key);
	}

	oo.newMap = function(m,n)			//返回新的棋局
	{
		var nm = m.slice(0);		//复制数组
		nm[n] = m.side;				//把新下的棋子放到棋盘上

		nm.key = m.key.slice(0);		//复制数组
		zobrist.set(nm.key,m.side==1?0:1,n);

		nm.frontier = m.frontier.slice(0);		//复制数组
		nm.frontier[n] = false;
		for (var i=0; i<8; i++)
		{
			var k = oo.dire(n,i);
			if (k!=64 && nm[k]==0)
				nm.frontier[k] = true;
		}

		var ne = m.next[n];
		var l = ne.length;
		for(var i=0; i<l; i++)
		{
			nm[ne[i]] = m.side;		//反转的棋子
			zobrist.set(nm.key,2,ne[i]);
		}
		if (m.side==1)
		{
			nm.black = m.black + l + 1;
			nm.white = m.white - l;
		}
		else
		{
			nm.white = m.white + l + 1;
			nm.black = m.black - l;
		}
		nm.space = 64 - nm.black - nm.white;		//空格数目
		nm.side = -m.side;
		nm.prevNum = m.nextNum;
		zobrist.swap(nm.key);
		return nm;
	}


	oo.goChess = function (n)	//走棋
	{
		history.push(map);
		oo.go(n);
	}

	oo.go = function (n)	//走棋
	{
		aiRuning = false;
		var rev = map.next[n];
		map = oo.newMap(map,n);
		map.newRev = rev;
		map.newPos = n;
		// console.log(map.key);
		update();
	}

	oo.historyBack = function ()
	{
		if (aiRuning || history.length==0)
			return;
		clearTimeout(timer);
		map = history.pop();
		update();
	}

	function setAIRunStatus(t)		//设置AI运算状态
	{
		aiRuningObj.style.display = t?"block":"none";
	}

	function setPassStatus(t)		//设置pass状态
	{
		passObj.style.display = t?"block":"none";
		if(t)
			passObj.innerHTML = map.side==1?"白方无棋可下，黑方继续下子":"黑方无棋可下，白方继续下子";
	}

}


var board = new Chessboard();
var ai = new AI();
var othe = new Othello();

board.create();
board.toDown = othe.goChess;

document.getElementById("play").onclick = function() {
	document.getElementById("selectbox").style.display = "block";
};
document.getElementById("back").onclick = function() {
	othe.historyBack();
};
document.getElementById("ok").onclick = function() {
	document.getElementById("selectbox").style.display = "none";
	var ro = document.getElementById("selectbox").getElementsByTagName("input");
	othe.aiSide = ro[0].checked?-1:1;
	for (var i = 2; i < ro.length; i++)
		if (ro[i].checked)
			break;
	ai.calculateTime = [20,100,500,2000,5000,10000,20000][i-2];
	ai.outcomeDepth = [7,10,13,14,15,16,17][i-2];
	othe.play();
};
document.getElementById("cancel").onclick = function() {
	document.getElementById("selectbox").style.display = "none";
};

document.getElementById("explain").onclick = function() {
	alert("黑白棋游戏说明\n【简介】\n黑白棋又叫反棋(Reversi)、奥赛罗棋(Othello)、苹果棋或翻转棋。游戏通过相互翻转对方的棋子，最后以棋盘上谁的棋子多来判断胜负。\n【规则】\n1．黑方先行，双方交替下棋。\n2．新落下的棋子与棋盘上已有的同色棋子间，对方被夹住的所有棋子都要翻转过来。可以是横着夹，竖着夹，或是斜着夹。夹住的位置上必须全部是对手的棋子，不能有空格。\n3．新落下的棋子必须翻转对手一个或多个棋子，否则就不能落子。\n4．如果一方没有合法棋步，也就是说不管他下到哪里，都不能至少翻转对手的一个棋子，那他这一轮只能弃权，而由他的对手继续落子直到他有合法棋步可下。\n5．如果一方至少有一步合法棋步可下，他就必须落子，不得弃权。\n6．当棋盘填满或者双方都无合法棋步可下时，游戏结束。结束时谁的棋子最多谁就是赢家。");
};

document.getElementById("no3d").onclick = function() {
	var desk = document.getElementById("desk");
	desk.className = desk.className=="fdd"?"":"fdd";
	this.innerHTML = desk.className=="fdd"?"2D":"3D";
};