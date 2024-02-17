# 第一篇万字长文：围绕透明代理的又一次探究

是的，你没有看错，还是这个主题。我也没什么办法，因为实在是不完美啊！比如：

* 腾讯会议、QQ 电话等类似软件断流
* 网易云音乐断流
* ……

为了解决这些问题，我辗转反侧的思考，日夜不停的实验，在树莓派和 J1900 之间反复横跳，安装 OpenWrt，使用 Redirect 代替 TProxy，更换不同的 DNS 查询思路，调试 V2Ray 配置等等。直到今天（真实情况是几天前），我又重新装回了亲切的 Ubuntu 20.04，趁机记录一下过程以及一些零碎的思考。

<!--more-->

> 仅以此文，作为大半年来所学知识与亲手实践之总结。

## 1. OpenWrt VS Ubuntu，哪一个更好用？

从表面上来说，作为路由器系统，OpenWrt 明显更占优势，相对于文本界面更易接受的网页后台，以及丰富的生态，使其广受好评。但另一方面，也许它也只能作为「路由器系统」了，或者说更适合在主路由上面使用，但对于旁路由和 x86 平台，反而有点鸡肋了，再加上个人觉得有时候命令行更加简洁好用，包括我在 OpenWrt 配置 V2Ray 时候都是直接使用 V2Ray-Core，而不是 LuCI 界面上的那种。反正我是各种用不惯，感觉和普通的 Linux 发行版差距太大，这就是我换回 Ubuntu 的原因。

那为什么我之前还要选择装 OpenWrt 呢？那就是内核优化的原因。考虑到它是专门适配路由器的，所以在内核的网络优化上或许和普通系统有些许不同，实际体验中也能感受到一些提升。但是毕竟没有明确的证据，网上也找不到非常有力的说法，自己水平不够，看不懂各种参数、源码，所以综合考虑后，还是换了回去。

## 2. DNS 服务器的选择

DNS，即 **D**omain **N**ame **S**ystem 是当今互联网的基础，DNS 服务器的正确配置十分重要，轻则拖慢上网速度，重则导致无法正常访问网络。

### 局域网 DNS 服务器的选择

在之前的文章中，我选择了监听 53 端口，使用 Telescope DNS 作为服务器。不过如果看过白话文教程中的配置，就会发现，那种思路和我的思路不同。设[白话文教程中的配置](https://guide.v2fly.org/app/tproxy.html)为 A 方式，[我的配置](https://moecm.com/tproxy-with-v2ray-on-rpi)为 B 方式，我们探讨一下他们的异同点。它们的流程看起来并不复杂，仔细分析后却觉得非常有趣。

首先是 A 方式，它的思路是将 DNS 查询的流量与其他流量放到一起，然后进入 V2Ray 的路由模块中将 DNS 查询流量（53 端口的 UDP 流量）分离出来，转向 DNS 出站协议，然后交给 V2Ray 内置 DNS 服务器进行处理，最后返回查询结果。而 B 方式的思路是通过外部程序（相对于 V2Ray 透明代理的外部）开放 53 端口建立 DNS 服务器进行查询。

这就是为何在 A 方式 iptables 的配置中有 `-d 192.168.0.0/16 -p udp ! --dport 53 -j RETURN` 的指令。「RETURN」 在这里的意思就是直连到旁路由并转发到主路由，而不经过 V2Ray 进行透明代理；「-d」后面加的是局域网 IP，如果到此为止的话其实功能基本正常，前提是将客户端的 DNS 服务器地址设为局域网地址以外的 IP 地址，原因就在于 DNS 查询流量需要和其他流量一起进入 V2Ray，然后再路由模块中被抽出进行查询以避免 DNS 污染，然而此时的 iptables 规则却将 DNS 查询流量直接发了出去（当然是在客户端 DNS 地址为局域网地址的情况下），显然达不到目的，所以加上后面的「-p udp ! --dport 53」也就是排除 53 端口 UDP 流量直连规则后，DNS 劫持可以做到基本完美了。而这，就是 A 方式的有趣点。

其实，在 A 方式与 B 方式之间还存在着另一种方案，即使用 V2Ray 入站任意门协议监听 53 端口成为 DNS 查询服务器。这种方式与 B 方式同样监听 53 端口，但不需要额外的程序，且 DNS 查询方式与 A 方式一样都是通过 V2Ray 路由转发到 DNS 出站协议，并调用内置 DNS 服务器进行查询。这种方式的有趣点主要在于入站和出站的两个协议上。

在考虑这个问题时，我曾在 V2Ray 的讨论区发过一个 [issue](https://github.com/v2ray/discussion/issues/751)，正是因为在其中和他人的交流，让我终于领悟了这个方案的原理和妙处。

> Dokodemo door（任意门）是一个入站数据协议，它可以监听一个本地端口，并把所有进入此端口的数据发送至指定服务器的一个端口，从而达到端口映射的效果。[^1]
>
> ```json
> {
>  "address": "8.8.8.8",
>  "port": 53,
>  "network": "tcp",
>  "timeout": 0,
>  "followRedirect": false,
>  "userLevel": 0
> }
> ```

抛开 `network`、`timeout`、`userLevel` 几个较容易理解的配置项，来谈谈 `followRedirect` 和 `address`（以及 `port`）。在透明代理的配置中，我们通过 Dokodemo-door 接受数据，流入 V2Ray 进行下一步处理，那时我们将 `followRedirect` 设为 `true`，按字面意思理解，就是将数据包重定向而不变换地址，此选项必须与透明代理联动，开启时 `address` 无效。这样看上去很合理，然而到了做 DNS 服务器的时候，一切都变了。此时必须指定地址和端口，否则会出现错误。所以这个地方，必须指定一个 DNS 服务器，而且是没有被污染的国外 DNS 服务器为佳。为什么呢？我们接着往下看。

之后根据路由的设定，流量会被转到 DNS 出站协议。

> DNS 是一个出站协议，主要用于拦截和转发 DNS 查询。此出站协议只能接收 DNS 流量（包含基于 UDP 和 TCP 协议的查询），其它类型的流量会导致错误。[^2]
>
> **在处理 DNS 查询时，此出站协议会将 IP 查询（即 A 和 AAAA）转发给内置的 [DNS 服务器](https://www.v2fly.org/config/dns.html)。其它类型的查询流量将被转发至它们原本的目标地址。**
>
> ```json
> {
>     "network": "tcp",
>     "address": "1.1.1.1",
>     "port": 53
> }
> ```

加粗的一句话道出了此协议的本质，DNS 出站协议的特点就在于一个自动化。V2Ray 内置的 DNS 服务器功能简单，只支持 A/AAAA 记录查询，所以流量在被导向 DNS 出站协议后会进行自动过滤，首先为防止导入错误流量，先把不是 DNS 查询的流量过滤出去，之后只将能查询的 DNS 流量导入内置 DNS 服务器中进行查询，其他流量正常出去。不过出去到哪里呢？当然是在 Dokodemo-door 中配置好的地址和端口了，所以这就是为什么建议配置无污染的 DNS 服务器。不过你也可以在 DNS 出站协议中配置 DNS 服务器地址，但显然这种二次配置没有太大意义。

到这里好像一切都结束，然而还两个问题仍待解决。

1. 分流

A/AAAA 记录进入内置 DNS 服务器可以被正确的分流进行查询，然而由于 DNS 协议是出站协议，无法进入路由模块，而且只能配置一个地址，所以其余的 DNS 记录既无法做到 DNS 分流，出站后也无法走代理，也就是会被劫持并污染。这个问题的解决方案就是代理 DNS 出站协议（如下），至于如何做到 DNS 分流？对不起，无法做到，请换方案。😏

```json
{
    "protocol": "dns",
    "tag": "dns-out",
    "proxySettings": {
        "tag": "VMess 或其他通向服务端的出站协议的标识"
    }
}
```

<ol start="2"><li>UDP 建立连接时绑定源地址失败</li></ol>

这个问题的体现在于，如果设备上某一 UDP 端口已被监听，无论是 V2Ray 还是其他软件监听，都会导致透明代理时访问同一端口的 UDP 服务时出错，日志中会出现 `failed to bind source address to [x x x x] > address already in use` 字样的错误。此错误属于 V2Ray 内部问题，暂时无解（除非您是大佬）。详情请见：[Report for ' failed to bind source address > address already in use' when using tproxy · Issue #68 · v2fly/v2ray-core](https://github.com/v2fly/v2ray-core/issues/68)。

以上很多内容其实都可以在[新白话文教程的 DNS 服务器篇](https://www.v2fly.org/config/dns.html)找到，我不过是用我自己的语言加上一点点的理解写下这些文字。最后放一张表格，供大家参考。

| 类型               | 优点                                                      | 缺点                                                         |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------------ |
| V2Ray 内部分离 DNS | 无需其他软件；无需监听端口；客户端 DNS 服务器地址可为任意 | `dig` 及类似指令无法正常使用；可扩展性低；A/AAAA 以外的 DNS 记录无法分流、缓存；Netfilter 配置略复杂 |
| V2Ray DNS 服务器   | 无需其他软件                                              | 存在 UDP 方面的 bug；可扩展性低；A/AAAA 以外的 DNS 记录无法分流、缓存；V2Ray 配置略复杂 |
| 外部 DNS 服务器    | 独立于 V2Ray，即使 V2Ray 不可用也可正常工作；可扩展性高   | 需要额外软件                                                 |

### 公网 DNS 服务器的选择

公共 DNS 服务器的选择很大一部分参考了苏卡卡的文章：[如何选择适合的公共 DNS？ \[2020\] | Sukka's Blog](https://blog.skk.moe/post/which-public-dns-to-use/)。

国内 DNS 服务器选择方面比较简单，速度快 + 可靠即可。不过这个「快」就要从两方面来说了，一方面是 DNS 查询速度，这个速度其实对体验影响不到，因为不过是几十毫秒；第二方面则是查找到的 IP 与你所在地域以及运营商之间的关系，小网站单 IP 直接连接还好说，但如果有 CDN 就不同了。理论上，ISP 给你分配的 DNS 服务器对于 CDN 是最友好的，访问时会连接到与你最近的服务器，然而口碑实在太差，天天各种污染劫持谁受的了？所以自然选择了公共 DNS 服务器。后来出了一种名为 ECS 的东西，简单来说它可以缓解前面说的问题，然而考虑到隐私、ECS 的缺点[^3]、DNS 服务商太懒以及**我太懒**，爱慢就慢吧。

国外 DNS 服务器同理，想要 CDN 友好的话，要么 ECS 设置为 V2Ray 服务端的 IP，要么远程解析 DNS，当然，我还是选择本地直接发起解析请求。选择方面，除了上面国内 DNS 服务器选择中说的两点，更重要的是**纯净**。一是服务器本身的纯净，国内一众 DNS 服务器，包括一开始我试用的红鱼 DNS，即使在使用 DoH、DoT 解析的情况下得到的结果仍是污染的，甚至得不到结果，所以自然要选择国外 DNS 服务器了；二是解析过程中的纯净，牢记：即使得不到也不要被污染的结果！既然决定即使是代理查询流量以规避污染的方法也不使用，那么传统 UDP 解析直接排除，是的，为了保证正确的结果，即使是非标准 53 端口的查询也不允许。之后就是 TCP 解析了，经过测试，在我这里，Google 的 `8.8.4.4` 和 OpenDNS 的 `208.67.222.222` 都可连通，且有不错的速度，尤其值得一提的是，后者支持 `5353` 和 `443`（不是 DoH）端口的查询。不过虽然 TCP 不会被污染，但是会被重置连接而无法得到结果，所以为了保险起见，我又添加了 Showfom 大佬的 DoH：`https://doh.dns.sb/dns-query`。根据 Telescope DNS 的并发请求功能和故障转移机制，可以相对快速的得到有效的返回结果。

服务器选好了，还有一个问题就是分流。以外的方案都是按域名分流，筛选国内域名使用国内 DNS 服务器解析，其余域名使用国外 DNS 服务器解析。然而这样做的缺点很多，首先就是需要维护一个域名列表，而域名背后指向的 IP 却不是一成不变的，所以需要经常更新；其次域名的地域性较低，国内域名可能使用的是国外服务器，而国外域名可能通过 GeoIP 解析到国内地址，再加上 CDN 的干扰，其实效果并不理想。也是因为 Telescope DNS 本身的设计和一篇 [issue](https://github.com/wolf-joe/ts-dns/issues/25) 中的启发，有以下过程：

![公网 DNS 服务器的查询过程](https://cdn.moecm.com/dns-resolution-on-internet.svg)

这个过程与软件[原本过程](https://github.com/wolf-joe/ts-dns/blob/master/README.md)相比，缺少了向 GFWList 比对的环节。我认为，被墙域名可能会由于 GFWList 未包含而返回错误结果。虽然比对可以减少向国外 DNS 服务器请求的无用功并节省时间，但与其节省几百毫秒，不如获得更准确的结果。

另外以 IP 地域为 DNS 解析分流好处就在于其地理位置基本不变，可以规避域名分流的弊端。这种方法的前提是被污染的域名返回的结果一定是非中国 IP，所以这种方法才能成功。

最后分别是 Telescope DNS 三个文件 `ts-dns.toml`、`gfwlist.txt`、`cnip.txt` 的写法。

```toml
# Telescope DNS Configure File
# https://github.com/wolf-joe/ts-dns

listen = ":53"
gfwlist = "gfwlist.txt"
gfwlist_b64 = false # 不使用 base64 解码 gfwlist.txt 文件以进行自定义（全部匹配）
cnip = "cnip.txt"
disable_ipv6 = true

hosts_files = ["/etc/hosts"]
[hosts]
"doh.dns.sb" = "104.27.159.178" # 此域名可自行查询并 ping IP 进行修改以得到最快的查询速度
"V2Ray 服务端域名" = "V2Ray 服务端 IP"

[query_log]
file = ""
ignore_cache = true
ignore_hosts = true

[cache]
size = 4096
min_ttl = 60
max_ttl = 86400

[groups]
  [groups.clean]
  no_cookie = true # 禁用 edns cookie，119.29.29.29 需要设置为true
  dns = ["119.29.29.29", "223.5.5.5"]
  concurrent = true

  [groups.dirty]
  dns = ["8.8.4.4/tcp", "208.67.222.222:443/tcp"]
  doh = ["https://doh.dns.sb/dns-query"]
  concurrent = true
```

```
||*
```

至于最后一个 `cnip.txt` 文件自带，所以无需配置，不过可以定期通过以下指令生成最新列表：[^4]

```shellsession
$ wget -c http://ftp.apnic.net/stats/apnic/delegated-apnic-latest
$ cat delegated-apnic-latest | awk -F '|' '/CN/&&/ipv4/ {print $4 "/" 32-log($5)/log(2)}' > cnip.txt
```

## 3. Sniffing 流量探测

流量探测，可以探测流量中的某些信息，还可以按目标地址重置当前连接的目标。[^5]

这样说起来不容易明白，不过它的用途十分明确：

1. 探测 BT 流量
2. 探测连接的目标域名
3. 解决 DNS 污染

首先是第一条，这个规则适合放在服务端上（客户端亦可，视具体情况而定），因为很多地区对这方面有严格的法律规定，通过 Sniffing 将 BT 流量探测出来，并在路由模块中进行处理，可以避免违反法律的问题。

其次是第二条，由于透明代理中客户端会首先将域名解析成 IP 再发给透明代理所在机器上，进入到 V2Ray 之内，这样就会导致路由模块中无法通过域名对流量进行分流。开启了探测之后就会将 IP 指向的目标域名探测出来，用于分流。

最后是第三条，这一条对应的「重置」这一功能。开启后它会将域名而不是 IP 发向服务端（我没有证据），规避了 DNS 污染的问题，不过这样的话，前面的 DNS 分流岂不是做无用功了？的确，在白话文 Redirect 方式透明代理的那篇教程中使用了这样的方法，在文章的最后还提到这种方式因为会频繁的向国内 DNS 服务商请求被污染的域名而存在隐私问题。事实上目前我们使用的 DNS 分流方案同样存在这一问题，不过为了良好的体验还是做出了一定的妥协。利用 V2Ray 流量探测并重置连接来解决 DNS 污染的方式既可以作为前文提到的三种内网 DNS 服务器的补充，也可以独立作为一种 DNS 污染的解决方案。实话说，虽然这种方式存在着一定的不可控性，但在实际使用中暂时没发现太大问题。所以若问我究竟应该选择何种方式去解决 DNS 污染的问题，我也只能说各有利弊，留待更多测试和体验。

## 4. 透明代理：Redirect VS TProxy？iptables VS nftables？

所谓透明代理指的就是在客户端不知情的情况下对流量进行代理，运用这种方式可以实现无感翻墙。

### Redirect (Redirect + TProxy) VS TProxy (纯 TProxy)

两种都是用来实现透明代理的方式，区别在于 Redirect 无法在 UDP 和 IPv6 中使用，TProxy 则无此限制。[Linux 内核文档](https://www.kernel.org/doc/Documentation/networking/tproxy.txt)中指出了 Redirect 在 UDP 中不可行，不过有[观点](https://www.jianshu.com/p/76cea3ef249d)认为这并不是技术上的不可行，而是人为设定。

不过这里就不讨论过多理论方面的问题了，因为我并不了解这方面的知识。或许不是每个人都明白有关电的原理，但明白按下开关可以打开灯就足够了。

> 不过我对此的理解就是当前方案是最适合内核结构的，也是开销最小的，也就是最优方案，所以没有必要去实现 Redirect 透明代理 UDP。

虽然看上去 TProxy 在各方面都不错，但在 OpenWrt 上进行透明代理时发现在使用会议软件时，Redirect 方案的断流情况与 TProxy 方案相比有减少。

不过我还是选择了 TProxy，也许是强迫症心理吧？

### iptables VS nftables

> Netfilter，在 Linux 内核中的一个软件框架，用于管理网络数据包。不仅具有网络地址转换（NAT）的功能，也具备数据包内容修改、以及数据包过滤等防火墙功能。[^6]

而 iptables 和 nftables 就是用来控制 Netfilter 的。


相较而言，大家可能对 iptables 更熟悉。新版的 Debian、RedHat 等 Linux 发行版已经将 nftables 作为默认的防火墙工具，[^7]但就目前情况而言 iptables 貌似还是主流选择。不过我抱着 nftables 能提升性能解决会议软件断流的希望，尝试了一下 nftables。

### 理想的局域网拓扑结构

在 V2EX 上，我看到了这样的一篇帖子：[对于所谓「旁路由」的疑惑 - V2EX](https://www.v2ex.com/t/663066)。

里面说的什么「动态路由表」我并不是十分了解，但是其中的很多思路却让我陷入沉思。

什么是旁路由？它是用来处理主路由不适合做的事情而出现的。比如说，V2Ray 的 VMess 协议需要加解密，而普通路由器的 CPU 性能一般都很弱，而且内存、磁盘空间都较小，不适合做这样的工作。这时候这一部分交给旁路由去处理，就可以解决这个问题。反过来说，如果主路由性能、功能足够强大，旁路由其实就没有必要存在了。

然而实际情况很残酷，除非将软路由作为主路由，否则旁路由还是十分需要的。在目前大部分的教程中，我们都需要手动或改变 DHCP 配置将网关改为旁路由网关，看完了那篇帖子后我在想，是否可以考虑将 Netfilter 配置放在主路由上，V2Ray、DNS 服务器等其他服务放在旁路由上，这样就可以使直连的流量不经过旁路由，直接从主路由出去，更加快速。虽然有这样的想法，但是家里的路由器好像无法刷机，所以这个想法还留待以后检验。

> 在开始写文章的不久后，我惊奇的发现，家里的主路由，小米路由器 4 好像可以刷机，而且不用拆机就可以直接登录，测试后发现果真如此。所以接下来的动手方向可能就是这个主路由了（真是不能闲着啊……）。

### 围绕 Netfilter 的数据流向与配置指令简析

由于在[之前的文章](https://moecm.com/tproxy-with-v2ray-on-rpi)中已经贴出了配置，这篇文章后面的配置只是进行了一些改变并套用到 nftables 之上，所以在真正开始配置 Netfilter 之前，我们先对自己设定的配置所产生的效果进行一定的了解。

首先看 `iptables -t mangle -A V2RAY [something] -j RETURN`，这一句作用很简单，匹配某些规则，将这些数据包 return，也就是返回。在当前环境中，数据包会从子链 V2RAY 返回到父链 PREROUTING 中，由于 PREROUTING 链并没有设置什么规则，所以就按缺省规则直接转发出去，达到了直连的目的。

接下来看 `iptables -t mangle -A V2RAY -p tcp -j TPROXY --on-port 12345 --tproxy-mark 1` 这条规则，它是所有规则中最重要的，也就是将数据包转到 V2Ray 中进行透明代理。问题是为什么要在后面加一个标记「1」呢？直接转到目标端口好像也并没有什么问题啊？这个问题就涉及到 Netfilter 的流量走向以及 Linux 的路由表了。

![](https://cdn.moecm.com/netfilter-packet-flow.svg)

<center><div class="image-caption">Netfilter 中包的流程图[^8]</div></center>

在这张非常经典的流程图中，我们看到，mangle 表的 prerouting 链上，流量会有两个走向，即 input 和 forward，其中 forward 是转发到外面，input 是到本机里面，很明显，我们的目标是让数据包走 input 链到 V2Ray 中进行透明代理（或者说，走什么链不重要，只要能从指定端口连接到本机就好）。然而现实很残酷，路由表可以控制流量走向，在默认规则中，路由表通过目标地址进行匹配，而我们透明代理流量的目标地址显然都是外部而不是本机，所以就会走 forward 到外部但是却找不到透明代理的目标也就是 V2Ray 监听的端口，导致网络连接无法建立。于是便有了以下指令：`ip route add local default dev lo table 100`，这条指令是建立一个名为 100 的路由表，并指向 `lo` 网卡即本机；`ip rule add fwmark 1 table 100` 这一条则是建立路由表 100 的规则：匹配有标记 1 的数据包走路由表 100。通过这两条指令以及 Netfilter 规则中向透明代理流量添加的标记 1，即可实现对局域网中客户端的透明代理。

接下来就是对本机的透明代理部分了。首先是 `iptables -t mangle -A V2RAY_MARK -p tcp -j MARK --set-mark 1` 这句，它的作用与 `iptables -t mangle -A V2RAY -p tcp -j TPROXY…` 一句相同，那为何写法却和后者不同呢？显然，在 prerouting 链上的透明代理不能应用于本机，而 postrouting 链会直接出去，所以最后只能在 output 链上进行设置，但是 output 链上并不允许设置透明代理，因为出去的包又会回到本机，造成了死循环（也有可能是 output 链之后就是 postrouting 链，又不存在路由判断，所以包没有机会走回本机）。好在天无绝人之路，output 链后存在一种机制叫做 reroute check，通过这种机制，我们只需将数据包打上和先前一样的标记 `1`，随后查路由表匹配规则，通过 `lo` 重新回到本机中，然后和其他从外面来的流量（如局域网设备的透明代理流量）混在一起，进行透明代理。最后一个需要解决的问题就是从 V2Ray 出来的流量应该如何处理，如果按现有配置运行，从 V2Ray 出来的流量经过 output 链时会重新被打回，造成死循环，所以只是需要在 V2Ray 内部向出站的数据包打一个标记「2」，也就是 `"mark": 2`，然后在 output 链上配置标记为 `2` 的数据包直连，也就是 `iptables -t mangle -A V2RAY_MARK -j RETURN -m mark --mark 2`，这样就可以实现对本机的透明代理了。

另外还有一个可以讨论的点：是否需要设定服务器 IP 直连？在 output 链中，如果添加一条目标地址为服务器 IP 直连的规则，同时删除标记 `2` 直连的规则，透明代理可以正常运行。这是因为从 V2Ray 出来的数据包的目标地址不是原地址而是 V2Ray 服务器地址，所以即使不过滤标记将从 V2Ray 出来的流量分流，通过找目标地址的方式分流仍然可以达到目的。但这种方式存在很多漏洞：output 链上设定的规则为特殊地址、国内地址、服务器地址、其他自定义地址直连，如果存在某个地址，它不属于以上 4 种地址中的任何一种，又会从 V2Ray 的 Freedom 出站协议中出来，就会导致访问此地址的流量陷入死循环。类似的极端情况可能还有很多，所以 output 链上设定标记 `2` 直连是必要的。不过在 prerouting 链上配置目标地址为服务器地址时直连以及在 output 链上额外设定此地址是否必要呢？就我个人体验和目前的方案（单服务器与多客户端）而言，是否设置没有太多使用上的区别，所以根据实际情况设置就好。

最后一个问题，是否应该设置 masquerade？在上面提到的[对于所谓「旁路由」的疑惑 - V2EX](https://www.v2ex.com/t/663066) 讨论中，有如下观点：[^9]

> <p>F 大的教程中有这么一句，「iptables -t nat -I POSTROUTING -j MASQUERADE」。这会导致国内下载流量经过 N1 旁路由，因为 MASQUERADE 会将 source ip 替换为 N1 的 ip，不管是否富强（注：应该指翻墙）。</p>
>
> 在 N1 上 POSTROUTING MASQUERADE 毫无必要，除非将 N1 当作主路由。

这个观点很明确，而且逻辑上也没有什么问题，从主路由直接连接到客户端肯定比经过旁路由更快。然而在实际使用中，在不设定 masquerade 的情况下，如果某流量在 Netfilter 中直接直连到外面，而不经过 V2Ray，就会出现各种问题，如：国内网页加载极其缓慢甚至无法加载；SSH 连接在快速输入字符或快速移动光标等键盘操作时会导致 SSH 掉线。之前由于我选择在 V2Ray 中进行分流操作，所以遇到 SSH 掉线问题时并没有太过注意，直到这次修改配置后，之前百思不得其解的问题终于得到解决。虽然不知道为什么会出现这样的结果，总之使用体验良好就是了。

### nftables 配置

无论是 iptables 还是 nftables，都需要先配置策略路由。

```shellsession
# ip route add local default dev lo table 100 # 添加路由表 100
# ip rule add fwmark 1 table 100 # 为路由表 100 设定规则
```

与 iptables 不同，nftables 的设定偏向于编辑文件，而不是执行指令。`iptables-save`  和 `iptables-restore` 的确可以保存和恢复 iptables 配置，但生成的文件可读性差。nftables 的配置文件容易编辑和阅读，指令执行的语句其实和配置文件的写法相同，不过这就会导致很多符号会在 Shell 中被识别为其他含义，可能需要转义、加引号、加空格等方式规避问题，体验较差。虽然 nftables 提供了一个互动模式，但是我更愿意去写配置文件，运行指令仅作为实验方式（有点像 Python？）。

首先编辑 `/etc/nftables.conf`：

```
#!/usr/sbin/nft -f

flush ruleset

include "/etc/nftables.d/*"

table ip v2ray {
	chain prerouting {
		type filter hook prerouting priority mangle; policy accept;
		ip daddr { $RESERVED_IP, $CHINA_IP, 8.8.4.4, 208.67.222.222, 104.27.159.178 } return
		ip protocol tcp tproxy to 127.0.0.1:12345 meta mark set 1
		ip protocol udp tproxy to 127.0.0.1:12345 meta mark set 1
	}
	chain output {
		type route hook output priority mangle; policy accept;
		ip daddr { $RESERVED_IP, $CHINA_IP, 8.8.4.4, 208.67.222.222, 104.27.159.178 } return
		meta mark 2 return
		ip protocol tcp meta mark set 1
		ip protocol udp meta mark set 1
	}
	chain postrouting {
		type nat hook postrouting priority srcnat; policy accept;
		masquerade
	}
}
```

之后创建 `/etc/nftables.d` 文件夹，并在其中创建 `reserved_ip.conf`、`china_ip.conf` 两个文件。

```
define RESERVED_IP = {
    10.0.0.0/8,
    100.64.0.0/10,
    127.0.0.0/8,
    169.254.0.0/16,
    172.16.0.0/12,
    192.0.0.0/24,
    192.168.0.0/16,
    224.0.0.0/4,
    240.0.0.0/4,
    255.255.255.255/32
}
```

```
define CHINA_IP = {
    1.1.8.0/24,
    1.2.4.0/24,
    …
    223.255.252.0/23
}
```

国内 IP 的完整列表可以通过上文 DNS 部分提到的指令生成，然后写成相同格式即可。

之后编辑 `/lib/systemd/system/nftables.service`。

```ini
[Unit]
Description=nftables
Documentation=man:nft(8) http://wiki.nftables.org
Wants=network-pre.target
Before=network-pre.target shutdown.target
Conflicts=shutdown.target
DefaultDependencies=no

[Service]
Type=oneshot
RemainAfterExit=yes
StandardInput=null
ProtectSystem=full
ProtectHome=true
ExecStart=/usr/sbin/nft -f /etc/nftables.conf ; /usr/sbin/ip route add local default dev lo table 100 ; /usr/sbin/ip rule add fwmark 1 table 100
ExecReload=/usr/sbin/nft -f /etc/nftables.conf
ExecStop=/usr/sbin/nft flush ruleset ; /usr/sbin/ip route del local default dev lo table 100 ; /usr/sbin/ip rule del table 100

[Install]
WantedBy=sysinit.target
```

最后设定开机并立即启动即可。

```shellsession
# systemctl enable nftables --now
```

## 5. V2Ray 中的 UDP 协议

我们先从小的地方说起。

文章开头，我就提到了一些使用 UDP 协议通讯的会议软件在透明代理环境中存在断流现象。之前一直以为是我个人问题，后来才了解到这是一个共性问题，比如：[使用 QUIC 协议观看视频断流](https://github.com/v2ray/v2ray-core/issues/1432)，[Zoom 会议断流](https://youth2009.org/v2ray-transparent-proxy-and-zoom-udp-optimization/)……

好在看到了后面的那篇博客，也趁着这次修改配置，通过 Netfilter 进行分流，使国内流量直连而不通过 V2Ray，一定程度上规避了 UDP 断流的问题，实际使用时也十分舒适，与正常使用几乎没有区别。不过如果用 V2Ray 代理游戏可能体验就没那么友好了。

在上文 DNS 部分提到的 53 端口问题同样与 UDP 有关。

此外，除 mKCP 和 QUIC 以外，V2Ray 的其他传输方式都是 UDP over TCP，即使用 TCP 传输 UDP。从各个方面来看，V2Ray 对 UDP 协议并不友好，随着网络技术更新换代，HTTP/3 普及，QUIC 协议会被广泛使用，那时候，UDP 的重要性会远超当下，所以我很期待 V2Ray 将来对 UDP 的优化。

## 6. 是否启用 IPv6？

至少对于我来说，No。

在之前的文章中，我简要的记录了我对 IPv6 的一些了解，虽然比较混乱，但还是说明了一些东西。首先我是支持 IPv6 的，无论从发展趋势还是使用效果上来说，IPv6 都有着不少的优点。比如随着带宽能力的提升，以及终端数量的增加，NAT 的弊端已经逐步体现出来了，而 IPv6 的出现能够真正使每一台设备都有至少一个**真正的互联网公网地址**，也就是「全球单播地址」，所谓 IPv6 自带内网穿透特性正是说它不同于 IPv4 的地址分配方式以及地址数量的庞大。然而从另一方面，我感到 IPv6 的复杂。从 IP 地址格式到 IP 地址分配，都令人感到费解。

如果说这些所谓的 IPv6 缺陷只是一时的难以适应以及相关知识的缺乏，那么针对我的实际体验情况而言，我的确无法选择使用 IPv6，这个问题的关键也许就在于主路由之上。首先请去浏览一下这位朋友的难题：[如何更改 IPv6 路由通告下发的默认路由网关配置 - V2EX](https://www.v2ex.com/t/685344)。他的问题不仅代表了我的问题，同时还简述了 IPv6 的地址分配机制，正是因为这种机制，我无法使旁路由作为网关以提供透明代理。或许通过更改主路由的配置可以解决这个问题，然而家里的小米路由器既缺陷各种功能，也无法刷成其他的路由器系统。综上，在我无数次实验之中，我放弃了。

而在实际体验这种 IPv4 单栈透明代理的过程中，也确实出现了不少的问题。比如，由于 IPv6 优先原则，DNS 解析到 IPv6 地址后会对其进行访问，而这个地址也许被污染了，或者即使是正确的，也因为无法进行透明代理而无法访问。

有这样一个实际例子：在使用 Magisk 模块仓库中，发现仓库列表无法刷新，通过抓包后发现，Magisk 的仓库列表位于 GitHub 之上，虽然 GitHub 并没有 IPv6 地址，但是由于系统使用 IPv6 的 DNS 服务器进行查询，而 IPv6 的 DNS 服务器并没有进行 DNS 污染处理，从而使得查询到的 IPv4 地址不可用，最终导致 Magisk 无法正常使用。在关闭了手机的 IPv6 之后，功能恢复正常。

连 GitHub 都没有 IPv6 地址，说明 IPv6 的实际使用率实在是低，生活中也很少能够发现只能 IPv6 访问服务（比如单栈 IPv6 VPS），所以的确是没有必要的。

> 然而我在写这一段的时候忽然想到是否存在以下可能：开启主路由 IPv6，配置 DNS 服务器指向旁路由的 Link-local 链路本地地址，然后在旁路由上关闭 IPv6 地址的 DNS 查询，如此就可以做到域名访问必走 IPv4 透明代理，同时又可以使用 IPv6 功能。待测试。

> 这种事情感觉没有什么价值，没必要为了 IPv6 而 IPv6。

## 7. 一些关于 V2Ray 的新东西

### 文档界面

V2Ray 和 V2Fly 有什么关系？简单来说，V2Fly 是 V2Ray 的社区版。由于 V2Ray 原开发者 Victoria Raymond 长期失联，为方便管理和维护，V2Ray 的开发者们自发的 Fork 了 V2Ray 项目以及官网等内容。所以查找资料时请浏览 v2fly.org 而不是 v2ray.com，后者已经无人维护，很多内容已经过时并存在缺失，而前者一直被社区维护，不久之前还重构了页面，更加美观、易读。

另外众所周知的由 ToutyRater 大佬编写的 V2Ray 白话文教程 toutyrater.github.io 已全部迁移到[新 V2Ray 白话文指南](https://guide.v2fly.org/) guide.v2fly.org，并不断更新更多的 V2Ray 玩法，由社区维护，欢迎提交 PR 来完善本指南。

### 安装方式

之前安装 V2Ray 都是使用我认为域名很好的那个脚本（https://install.direct/go.sh）进行安装，但在 V2Ray 文档中提到，不再推荐使用老脚本，转为使用新脚本（原因及区别请自行浏览[文档](https://www.v2fly.org/guide/install.html#linux-安装脚本)）。

> 目前 V2Ray 项目组已经将老脚本废弃，转为使用新脚本。

```shellsession
$ wget https://raw.githubusercontent.com/v2fly/fhs-install-v2ray/master/install-release.sh
# bash install-release.sh
```

### 自定义规则

除了安装脚本以外，项目中还提供了一个用于更新内置规则文件的脚本，不过这里我不会去使用它。原因是我使用了其他的文件去代替官方内置的文件：[Loyalsoldier/v2ray-rules-dat: 🦄 🎃 👻 V2Ray 路由规则文件加强版，可代替官方规则文件。Enhanced edition of V2Ray routing rules dat files.](https://github.com/Loyalsoldier/v2ray-rules-dat)。此项目已被收入官网文档之中。它相当于官方规则的超集，并添加了更多的类别，每天 Github Actions 自动生成。更棒的是，域名规则可以通过 Fork 此项目进行自定义，并自动生成规则文件。

### 多文件配置

> 自版本 `4.23.0` 起，V2Ray 程序支持使用多个配置文件。
>
> 多配置文件的主要作用在于分散不同作用模块配置，便于管理和维护。该功能主要考虑是为了丰富 V2Ray 的生态链，比如对于 GUI 的客户端，一般只实现节点选择等固定的功能，对于太复杂的配置难以图形化实现；只需留一个 `confdir` 的自定义配置目录供配置复杂的功能；对于服务器的部署脚本，只需往 `confdir` 添加文件即可实现配置多种协议，等等。[^10]

通过这样的一个新的设计，我将配置文件分为路由部分、DNS 服务器部分（之前）和其他配置文件部分，在结合上面提到的自定义规则，现在的配置文件更便于维护，看起来更加赏心悦目。

首先编辑 `/usr/local/etc/v2ray/00_base.json`（使用新脚本安装的 V2Ray 配置文件目录）：

```json
{
  "log": {
    "error": "/var/log/v2ray/error.log",
    "access": "/var/log/v2ray/access.log",
    "loglevel": "error"
  },
  "inbounds": [
    {
      "port": 12345,
      "protocol": "dokodemo-door",
      "settings": {
        "network": "tcp,udp",
        "followRedirect": true
      },
      "sniffing": {
        "enabled": true,
        "destOverride": [
          "http",
          "tls"
        ]
      },
      "streamSettings": {
        "sockopt": {
          "tproxy": "tproxy"
        }
      }
    },
    {
      "port": 1080,
      "protocol": "socks",
      "sniffing": {
        "enabled": true,
        "destOverride": [
          "http",
          "tls"
        ]
      },
      "settings": {
        "auth": "noauth",
        "udp": true
      }
    }
  ],
  "outbounds": [
    {
      "tag": "direct",
      "protocol": "freedom",
      "settings": {
        "domainStrategy": "UseIPv4"
      },
      "streamSettings": {
        "sockopt": {
          "mark": 2
        }
      }
    },
    {
      "tag": "proxy",
      "protocol": "vmess",
      "settings": {
        "vnext": [
          {
            "address": "服务端地址或域名",
            "port": 服务端端口,
            "users": [
              {
                "id": "UUID",
                "alterId": 4,
                "security": "auto"
              }
            ]
          }
        ]
      },
      "streamSettings": {
        "network": "tcp",
        "security": "tls",
        "sockopt": {
          "mark": 2
        }
      }
    },
    {
      "tag": "block",
      "protocol": "blackhole",
      "settings": {
        "response": {
          "type": "http"
        }
      }
    }
  ]
}
```

然后编辑 `/usr/local/etc/v2ray/01_routing.json`：

```json
{
  "routing": {
    "domainStrategy": "IPIfNonMatch",
    "rules": [
      {
        "type": "field",
        "outboundTag": "block",
        "domain": [
          "geosite:category-ads-all",
          "adservice"
        ]
      },
      {
        "type": "field",
        "outboundTag": "block",
        "ip": [
          "101.227.97.240/32",
          "101.227.200.11/32",
          "101.227.200.28/32",
          "124.192.153.42/32",
          "39.107.15.115/32",
          "47.89.59.182/32",
          "103.49.209.27/32",
          "123.56.152.96/32",
          "61.160.200.223/32",
          "61.160.200.242/32",
          "61.160.200.252/32",
          "61.174.50.214/32",
          "111.175.220.163/32",
          "111.175.220.164/32",
          "122.229.8.47/32",
          "122.229.29.89/32",
          "124.232.160.178/32",
          "175.6.223.15/32",
          "183.59.53.237/32",
          "218.93.127.37/32",
          "221.228.17.152/32",
          "221.231.6.79/32",
          "222.186.61.91/32",
          "222.186.61.95/32",
          "222.186.61.96/32",
          "222.186.61.97/32",
          "106.75.231.48/32",
          "119.4.249.166/32",
          "220.196.52.141/32",
          "221.6.4.148/32",
          "114.247.28.96/32",
          "221.179.131.72/32",
          "221.179.140.145/32",
          "115.182.16.79/32",
          "118.144.88.126/32",
          "118.144.88.215/32",
          "118.144.88.216/32",
          "120.76.189.132/32",
          "124.14.21.147/32",
          "124.14.21.151/32",
          "180.166.52.24/32",
          "211.161.101.106/32",
          "220.115.251.25/32",
          "222.73.156.235/32"
        ]
      },
      {
        "type": "field",
        "outboundTag": "proxy",
        "domain": [
          "geosite:geolocation-!cn",
          "pinterest",
          "porn",
          "github",
          "githubusercontent",
          "blogspot",
          "alibabacloud",
          "wikileaks",
          "nyaa.si",
          "rarbg"
        ]
      },
      {
        "type": "field",
        "outboundTag": "proxy",
        "ip": [
          "109.239.140.0/24",
          "14.102.250.18",
          "14.102.250.19",
          "149.154.164.0/22",
          "149.154.168.0/22",
          "149.154.172.0/22",
          "174.142.105.153",
          "50.7.31.230",
          "67.220.91.15",
          "67.220.91.18",
          "67.220.91.23",
          "69.65.19.160",
          "72.52.81.22",
          "85.17.73.31",
          "91.108.4.0/22",
          "91.108.56.0/22",
          "91.108.56.0/23",
          "108.177.120.94",
          "108.177.120.0/24",
          "172.217.0.0/16",
          "74.125.0.0/16",
          "geoip:jp",
          "geoip:us",
          "geoip:sg",
          "geoip:hk",
          "geoip:tw",
          "23.246.0.0/18",
          "37.77.184.0/21",
          "45.57.0.0/17",
          "64.120.128.0/17",
          "66.197.128.0/17",
          "108.175.32.0/20",
          "192.173.64.0/18",
          "198.38.96.0/19",
          "198.45.48.0/20",
          "173.245.48.0/20",
          "103.21.244.0/22",
          "103.22.200.0/22",
          "103.31.4.0/22",
          "141.101.64.0/18",
          "108.162.192.0/18",
          "190.93.240.0/20",
          "188.114.96.0/20",
          "197.234.240.0/22",
          "198.41.128.0/17",
          "162.158.0.0/15",
          "104.16.0.0/12",
          "172.64.0.0/13",
          "131.0.72.0/22",
          "144.220.0.0/16",
          "52.124.128.0/17",
          "54.230.0.0/16",
          "54.239.128.0/18",
          "52.82.128.0/19",
          "99.84.0.0/16",
          "204.246.172.0/24",
          "54.239.192.0/19",
          "70.132.0.0/18",
          "13.32.0.0/15",
          "205.251.208.0/20",
          "13.224.0.0/14",
          "13.35.0.0/16",
          "204.246.164.0/22",
          "204.246.168.0/22",
          "71.152.0.0/17",
          "216.137.32.0/19",
          "205.251.249.0/24",
          "99.86.0.0/16",
          "52.46.0.0/18",
          "52.84.0.0/15",
          "204.246.173.0/24",
          "130.176.0.0/16",
          "205.251.200.0/21",
          "204.246.174.0/23",
          "64.252.128.0/18",
          "205.251.254.0/24",
          "143.204.0.0/16",
          "205.251.252.0/23",
          "204.246.176.0/20",
          "13.249.0.0/16",
          "54.240.128.0/18",
          "205.251.250.0/23",
          "52.222.128.0/17",
          "54.182.0.0/16",
          "54.192.0.0/16",
          "2400:cb00::/32",
          "2606:4700::/32",
          "2803:f800::/32",
          "2405:b500::/32",
          "2405:8100::/32",
          "2a06:98c0::/29",
          "2c0f:f248::/32",
          "103.2.30.0/23",
          "125.209.208.0/20",
          "147.92.128.0/17",
          "203.104.144.0/21",
          "91.108.4.0/22",
          "91.108.8.0/22",
          "91.108.12.0/22",
          "91.108.16.0/22",
          "91.108.56.0/22",
          "149.154.160.0/20",
          "2001:b28:f23d::/48",
          "2001:b28:f23f::/48",
          "2001:67c:4e8::/48",
          "3.123.36.126/32",
          "35.157.215.84/32",
          "35.157.217.255/32",
          "52.58.209.134/32",
          "54.93.124.31/32",
          "54.162.243.80/32",
          "54.173.34.141/32",
          "54.235.23.242/32",
          "169.45.248.118/32"
        ]
      }
    ]
  }
}
```

## What else?

到这里，我知道的恐怕都讲完了，不过还是有一些话想说一说。其实本来这篇文章不会拖到这么晚才写完，主要是中间有一段时间电脑坏了，打乱了节奏，就一拖再拖。

V2Ray 是一款我很喜欢的软件，首先它并不只是用来翻墙的，正向代理、反向代理、透明代理、DNS 服务器、广告过滤它都可以胜任。

> Project V 是一个工具集合，它可以帮助你打造专属的基础通信网络。Project V 的核心工具称为 `V2Ray`，其主要负责网络协议和功能的实现，与其它 Project V 通信。V2Ray 可以单独运行，也可以和其它工具配合，以提供简便的操作流程。

是的，请不要忘记它的雄心壮志，V2Ray 只是一个核心，但不是全部。

我时常着迷于 V2Ray 的模块组合，每一个协议和传输并不复杂，但组合起来却是千变万化，带来无限的可能性。就像数学中的一个个变量，组合起来就会变成复杂的函数。

V2Ray 的社区氛围很好，每天不断的有 issue 被提出，同时又有人提交 PR，最后合并入主线。V2Ray 版本迭代的速度很快，不长时间就会出现新的功能。尤其是从 V2Ray 被发现多个大漏洞事件开始，几个月的时间，一个新的协议已经被开发出来。

VLESS，一个懂得做减法的协议，轻量而又功能丰富，貌似对 UDP 还进行了一定的优化。

还有一个关于上文的方案中没有提到的 V2Ray 分流的问题。由于很大一部分地址在进入 V2Ray 之前就被 Netfilter 分流直接出去，所以 V2Ray 路由模块中转往 Blackhole 的流量如广告过滤功能失效。看来将 V2Ray 的一部分功能分担出去就会导致连锁反应。

说是大半年，其实已经快一年了，我的自我学习过程往往都以实践为主，先做再学习原理，在某种动机的驱使下，查找各种资料并进行测试，有时还需要冥思苦想，在这样一个艰难的过程中，不断收获着各种知识，这个过程其实是我很享受的。虽然如此，但有时也是被逼无奈，如果不是身处特殊的环境下，怎么又会有研究的动机呢？

在此想要感谢很多人，除了下面撰写参考和引用中那些文章的人，也要感谢所有为这一切做出贡献的人。没有你们的付出，也不会有我这篇文章。

至此，本方案使用体验十分良好，如果没有特殊情况，围绕着 V2Ray 展开的各种计算机网络话题就要告一段落了。尽请期待更多精彩内容！

## 参考

1. [漫谈各种黑科技式 DNS 技术在代理环境中的应用 | by Tachyon | Medium](https://medium.com/@TachyonDevel/%E6%BC%AB%E8%B0%88%E5%90%84%E7%A7%8D%E9%BB%91%E7%A7%91%E6%8A%80%E5%BC%8F-dns-%E6%8A%80%E6%9C%AF%E5%9C%A8%E4%BB%A3%E7%90%86%E7%8E%AF%E5%A2%83%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8-62c50e58cbd0)

2. [DNS及其应用 — Steemit](https://steemit.com/cn/@v2ray/dns)

3. [关于在配置 V2Ray 做 DNS 服务器过程中引出的问题 · Issue #751 · v2ray/discussion](https://github.com/v2ray/discussion/issues/751)

4. [Report for ' failed to bind source address > address already in use' when using tproxy · Issue #68 · v2fly/v2ray-core](https://github.com/v2fly/v2ray-core/issues/68)

5. [DNS 服务器 | V2Fly.org](https://www.v2fly.org/config/dns.html)

6. [如何选择适合的公共 DNS？ \[2020\] | Sukka's Blog](https://blog.skk.moe/post/which-public-dns-to-use/)

7. [VMess | 新 V2Ray 白话文指南](https://guide.v2fly.org/basics/vmess.html)

8. [对于所谓“旁路由”的疑惑 - V2EX](https://www.v2ex.com/t/663066)

9. [透明代理 UDP 为什么要用 TProxy？ - 简书](https://www.jianshu.com/p/5393fb5e2c87)

10. [V2RAY透明代理 | xdays](https://xdays.me/V2RAY%E9%80%8F%E6%98%8E%E4%BB%A3%E7%90%86/)

11. [搭建网关系列 —— 路由篇](https://onebitbug.me/2014/06/03/building-a-gateway-route/)

12. [TProxy - The Linux Kernel Archives](https://www.kernel.org/doc/Documentation/networking/tproxy.txt)

13. [Linux使用TPROXY进行UDP的透明代理 - 简书](https://www.jianshu.com/p/76cea3ef249d)

14. [Internet sharing - ArchWiki](https://wiki.archlinux.org/index.php/Internet_sharing)

15. [nftables - ArchWiki](https://wiki.archlinux.org/index.php/Nftables)

16. [nft(8) — Arch manual pages](https://jlk.fjfi.cvut.cz/arch/manpages/man/nft.8)

17. [Sets - nftables wiki](https://wiki.nftables.org/wiki-nftables/index.php/Sets)

18. [Moving from iptables to nftables - nftables wiki](https://wiki.nftables.org/wiki-nftables/index.php/Moving_from_iptables_to_nftables)

19. [Moving from ipset to nftables - nftables wiki](https://wiki.nftables.org/wiki-nftables/index.php/Moving_from_ipset_to_nftables)

20. [nftables初体验|I'm OWenT](https://owent.net/2020/2002.html)

21. [包的路由转圈圈——谈谈使用nftables配置透明代理碰到的那些坑 | KosWu 's blog](https://koswu.github.io/2019/08/19/tproxy-config-with-nftables/)

22. [【Linux】vim在每行行首或行尾添加/删除内容_子非鱼的博客-CSDN博客_ubuntu vi编辑器删除每行开头](https://blog.csdn.net/wangchao7281/article/details/53318670)

12. [TProxy實現透明代理 - 小學霸](https://xuebaxi.com/blog/2019-11-23-01)

13. [使用 iptables、ipset 的全局智能代理 | chih's blog](https://blog.chih.me/global-proxy-within-ipset-and-iptables.html)

14. [V2Ray 透明代理和Zoom优化](https://youth2009.org/v2ray-transparent-proxy-and-zoom-udp-optimization/)

15. [Dokodemo UDP转发导致断流 · Issue #1432 · v2ray/v2ray-core](https://github.com/v2ray/v2ray-core/issues/1432)

27. [如何更改 IPv6 路由通告下发的默认路由网关配置 - V2EX](https://www.v2ex.com/t/685344)

28. [Project V · Project V 官方网站](https://www.v2ray.com/)

29. [V2Ray 配置指南|V2Ray 白话文教程](https://toutyrater.github.io/)

30. [V2Fly.org](https://www.v2fly.org/)

31. [V2Ray 配置指南 | 新 V2Ray 白话文指南](https://guide.v2fly.org/)

32. [V2Ray完全配置指南 – Ai](https://ailitonia.com/archives/v2ray完全配置指南/)

## 引用

[^1]: [Dokodemo-door | V2Fly.org](https://www.v2fly.org/config/protocols/dokodemo.html)

[^2]: [DNS | V2Fly.org](https://www.v2fly.org/config/protocols/dns.html)

[^3]: [使用公共 DNS 上网的弊端（二） | Ephen‘s Blog](https://ephen.me/2017/PublicDns_2/)

[^4]: [哪里有cnip.txt文件？ · Issue #2 · wolf-joe/ts-dns](https://github.com/wolf-joe/ts-dns/issues/2)

[^5]: [Inbounds | V2Fly.org](https://www.v2fly.org/config/inbounds.html)

[^6]: [Netfilter - 维基百科，自由的百科全书](https://zh.wikipedia.org/wiki/Netfilter)

[^7]: [第 2 章 Debian 10 的新变化](https://www.debian.org/releases/stable/mips/release-notes/ch-whats-new.zh-cn.html#nftables)

[^8]: [Jan Engelhardt / CC BY-SA (https://creativecommons.org/licenses/by-sa/3.0)](https://commons.wikimedia.org/wiki/File:Netfilter-packet-flow.svg)

[^9]: [对于所谓“旁路由”的疑惑 - V2EX](https://www.v2ex.com/t/663066)

[^10]: [多文件配置 | V2Fly.org](https://www.v2fly.org/config/multiple_config.html)