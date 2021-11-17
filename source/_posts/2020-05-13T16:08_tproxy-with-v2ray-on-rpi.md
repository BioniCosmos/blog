---
title: 树莓派 + V2Ray 配置翻墙路由器
permalink: /tproxy-with-v2ray-on-rpi/
date: 2020-05-13 16:08
---

这篇文章主要是记录如何在将树莓派作为旁路由，配合 V2Ray，搭建透明代理，以实现局域网内设备的无感翻墙。

<!--more-->

## 1. 刷写系统

我使用的是 Ubuntu Server 20.04，当然，其他系统也可以。刷写工具为 Win32DiskImager。

## 2. 更改 APT 软件源

```bash
# apt edit-sources
```

这里选择你喜欢的编辑器即可，我选择的是 Vim。

如果你也一样，可以像我接下来这样替换软件源，此处我选择清华源。

```vim
:%s/ports.ubuntu.com/mirrors.tuna.tsinghua.edu.cn/g
```

修改后保存并退出即可。之后运行：

```shell
# apt update && apt upgrade
```

更新并升级。

## 3. 配置内核、网络（静态地址）

新版 Ubuntu 默认使用 Netplan + Systemd-networkd 管理网络，而 Netplan 文件使用了可读性高且人性化的 YAML 格式文件。

```shell
# vim /etc/netplan/50-cloud-init.yaml
```

```yaml
network:
    ethernets:
        eth0:
            dhcp4: false
            dhcp6: false
            link-local: [] # 停止自动获取 IP 地址
            accept-ra: false # 同时不接受 IPv6 地址的广播
            # optional: true # 值为「真」时，开机时不等待获取到网络。这里作为路由器，我就注释掉了
            addresses:
                - 192.168.0.5/24 # IP 地址，注意有子网长度，相当于 IP 地址 + 子网掩码
            gateway4: 192.168.0.1 # 网关地址
            nameservers:
                addresses:
                    - 192.168.0.1 # DNS 服务器地址
    version: 2
```

保存退出后运行：

```shell
# netplan apply
```

这里由于配置了修改了 IP，如果使用 SSH 连接的话，将会断线，重连即可。

使用：

```shell
$ ip addr show
```

可以查看本机 IP 地址。

编辑 `/etc/sysctl.conf` 配置包转发：

```
…
# Uncomment the next line to enable packet forwarding for IPv4
net.ipv4.ip_forward=1
…
```

```shell
# sysctl -p
```

运行以上指令后，转发即可生效。

## 4. 安装 V2Ray

使用官方脚本即可*（实话说这域名不错）*。

```sh
$ wget https://install.direct/go.sh
# bash go.sh
```

然而由于安装时脚本需要从 GitHub 上下载最新的程序文件，所以速度很慢。所以需要通过本机代理下载或者在其他设备上下载后进行本地安装。

运行

```shell
# bash go.sh -h
```

后可以看到以下输出：

```
./install-release.sh [-h] [-c] [--remove] [-p proxy] [-f] [--version vx.y.z] [-l file]
  -h, --help            Show help
  -p, --proxy           To download through a proxy server, use -p socks5://127.0.0.1:1080 or -p http://127.0.0.1:3128 etc
  -f, --force           Force install
      --version         Install a particular version, use --version v3.15
  -l, --local           Install from a local file
      --remove          Remove installed V2Ray
  -c, --check           Check for update
```

这里我通过一台境外 VPS 下载安装包，之后通过 `scp` 指令传输到本地进行安装。具体步骤请自行查询。注意手动从 GitHub 上进行下载时要选对架构，实在分不清可以先运行一下脚本，这是会输出下载链接，然后结束运行，复制链接，下载。

安装过程中脚本会自动修复依赖和创建 Systemd 单元。

## 5. 配置 V2Ray

接下来我们就要进入重头戏：配置 V2Ray 透明代理。我的思路是由 V2Ray 的 Dokodemo door（任意门）协议接收除 53 端口的 UDP 和特殊地址以外的流量，之后通过内置的路由功能进行分流，分流方式为代理被墙域名和 IP 列表，其他全部直连。至于 53 端口的 UDP 流量，也就是 DNS 查询，通过一个 DNS 分流器进行分流，以防污染。

好，思路解释完毕，下面开始实践。首先我们编辑 V2Ray 配置文件：`/etc/v2ray/config.json`。

```json
{
  "log": {
    "error": "/var/log/v2ray/error.log", // 错误日志目录
    "access": "/var/log/v2ray/access.log", // 访问日志目录
    "loglevel": "error" // 错误日志级别
  },
  "inbounds": [
    {
      "protocol": "dokodemo-door", // 透明代理流量入口
      "port": 12345, // 端口，可自定义
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
          "tproxy": "tproxy" // 使用 TPROXY 方式实现透明代理，相应的还有 REDIRECT 方式
        }
      }
    },
    {
      "port": 1080,
      "protocol": "socks", // SOCKS 代理，可选，方便测试
      "sniffing": {
        "enabled": true,
        "destOverride": [
          "http",
          "tls"
        ]
      },
      "settings": {
        "auth": "noauth",
        "udp": true,
        "ip": "127.0.0.1"
      }
    },
    {
      "port": 8081,
      "protocol": "http", // HTTP 代理，可选，想用、会用可以保留
      "sniffing": {
        "enabled": true,
        "destOverride": [
          "http",
          "tls"
        ]
      }
    }
  ],
  "outbounds": [
    {
      "tag": "direct", // 出口流量直连标签
      "protocol": "freedom",
      "streamSettings": {
        "sockopt": {
          "mark": 2 // 一个可爱的小标记，数字自定义（可能有范围，使用「2」即可），后面能用到
        }
      }
    },
    {
      "tag": "proxy", // 出口流量代理标签
      "protocol": "vmess", // V2Ray 服务端信息配置
      "settings": {
        "vnext": [
          {
            "address": "服务器地址或域名",
            "port": 端口,
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
        "network": "ws", // WebSocket 传输方式配置，请根据实际情况进行修改
        "wsSettings": {
          "path": "路径"
        },
        "security": "tls",
        "sockopt": {
          "mark": 2 // 和上面一样可爱的小标记，两者需相同，后面能用到
        }
      }
    },
    {
      "tag": "block", // 出口流量丢弃标签
      "protocol": "blackhole",
      "settings": {
        "response": {
          "type": "http"
        }
      }
    }
  ],
  "routing": {
    "domainStrategy": "IPIfNonMatch", // 此方式匹配最为全面
    "rules": [
      {
        "type": "field",
        "outboundTag": "proxy",
        "ip": [
          // 需要远程解析的 DNS 服务器地址，单独列出，方便维护，与后面 DNS 分流器中的地址相同
        ]
      },
      {
        "type": "field",
        "outboundTag": "block",
        "domain": [
          // 一些想要禁止访问的域名，如广告
        ]
      },
      {
        "type": "field",
        "outboundTag": "block",
        "ip": [
          // 一些想要禁止的 IP，目的同上
        ]
      },
      {
        "type": "field",
        "outboundTag": "proxy",
        "domain": [
          // 一些想要代理的域名，如被墙的域名
        ]
      },
      {
        "type": "field",
        "outboundTag": "proxy",
        "ip": [
          // 一些想要代理的 IP，目的同上（Telegram 就需要指定 IP 走代理）
        ]
      }
    ]
  }
}
```

配置文件虽然很长，但是配合注释来看比较好理解，请根据实际情况进行修改。需要注意的是，如果在 VSCode、Vim 等编辑器中修改本文件，可能会对有注释的地方报错，这是因为 JSON 格式的文件理论上不支持注释，然而 V2Ray 程序却支持，所以不删除注释也不会影响正常使用。

另外，上面的配置最后有几个包含「一些想要」注释开头的数组（即中括号「`[]`」内），其中的内容需要按照实际情况进行修改，这里我分享一下自用的规则：[`config_routing.json`](https://cloud.moecm.com/#/s/p6U5)，下载后补充到上面配置文件中即可。这里需要注意的是，我分享的规则中的 Block 部分由于过于强力，可能会导致一些网站无法正常使用（已发现并修改：B 站登录界面、优酷播放界面），所以介意的话可以删除这一部分。如果想要使用，还要解决这个问题，请在网页功能无法正常使用时打开浏览器的开发人员工具，里面应该会提示某一域名（IP）无法访问的错误，之后在配置中查找此域名（IP）并将其删除即可。

如果以上步骤都做好了，那么就可以保存退出了。

现在运行

```shell
# /usr/bin/v2ray/v2ray -config /etc/v2ray/config.json -test
```

如果无报错，出现 `Configuration OK.` 则说明配置文件表面上没有错误。

最后，需要修改一下 `/etc/systemd/system/v2ray.service` 文件，以免运行时出现错误：

```ini
…
[Service]
…
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_NET_RAW CAP_NET_ADMIN
# 4.23.1 需要在 「CapabilityBoundingSet」 的最后添加 「CAP_NET_ADMIN」，否则透明代理无法正常使用
…
LimitNPROC=500
LimitNOFILE=1000000
# 修改后解决日志中出现非常多「too many open files」的问题
```

```shell
# systemctl daemon-reload
```

这里有一个可选的步骤，如果细心查看配置的话，可能会在路由规则中发现与 `geosite:category-ads-all` 类似的奇怪字样，这些其实是 V2Ray 中自带的域名（IP）规则，但是此规则文件只能随着 V2Ray 版本更新而更新，所以如果有新的域名出现，不会及时进行补充（虽然内置规则加上配置中的其他规则足够了）。不过有人利用 GitHub Action 每天自动生成此规则文件，其中除了官方自带的地址，又增加了一些地址，以便更好的满足使用者的需求。

使用方法很简单：用 [`geoip.dat`](https://github.com/Loyalsoldier/v2ray-rules-dat/raw/release/geoip.dat) 和 [`geosite.dat`](https://github.com/Loyalsoldier/v2ray-rules-dat/raw/release/geosite.dat) 两个文件替换 `/usr/bin/v2ray` 目录下的同名文件即可。

最后重启 V2Ray。

```shell
# systemctl restart v2ray
```

之后可以使用 cURL 测试配置是否正确（所以建议添加 SOCKS 代理以便测试）。

```shell
$ curl -x socks5h://127.0.0.1:1080 google.com
```

```html
<HTML><HEAD><meta http-equiv="content-type" content="text/html;charset=utf-8">
<TITLE>301 Moved</TITLE></HEAD><BODY>
<H1>301 Moved</H1>
The document has moved
<A HREF="http://www.google.com/">here</A>.
</BODY></HTML>
```

如出现问题，请检查配置和日志文件（可能需要调整错误日志级别以获取更多信息）。

## 6. 配置 DNS 服务器（Telescope DNS 分流器）

[Telescope DNS](https://github.com/wolf-joe/ts-dns) 是一位大佬用 Go 语言开发的 DNS 分流器，在这里使用非常合适，大家觉得好用可以去给项目一个 Star。

安装与配置 Systemd 单元的教程在项目主页上面都有，这里不作过多讲解。

如果已经安装好了，先不要着急启动。

首先，我们修改 Telescope DNS 的配置文件：`/etc/ts-dns/ts-dns.toml`。

```toml
# Telescope DNS Configure File
# https://github.com/wolf-joe/ts-dns

listen = ":53"  # 监听端口
gfwlist = "gfwlist.txt"  # gfwlist文件路径，release包中已预下载。官方地址：https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt
gfwlist_b64 = true  # 是否使用base64解码gfwlist文件，默认为true
cnip = "cnip.txt"  # 中国ip网段列表，用于辅助域名分组
disable_ipv6 = true  # 禁用IPv6地址解析，默认为false

hosts_files = ["/etc/hosts"]  # hosts文件路径，支持多hosts
[hosts] # 自定义域名映射
"cloudflare-dns.com" = "1.0.0.1"  # 防止下文提到的DoH回环解析，此处地址与 V2Ray 路由规则中的地址相同
"dns.google" = "8.8.8.8"
"dns.adguard.com" = "176.103.130.130"
"dns.quad9.net" = "9.9.9.9"

[query_log]
file = ""  # dns请求日志文件，值为/dev/null时不记录，值为空时记录到stdout
ignore_qtypes = ["DNSKEY", "NS"]  # 不记录指定类型的dns请求，默认为空
ignore_cache = true  # 不记录命中缓存的dns请求，默认为false
ignore_hosts = true  # 不记录命中hosts的dns请求，默认为false

[cache]  # dns缓存配置
size = 4096  # 缓存大小，为负数时禁用缓存
min_ttl = 60  # 最小ttl，单位为秒
max_ttl = 86400  # 最大ttl，单位为秒

[groups] # 对域名进行分组
  [groups.clean]  # 必选分组，默认域名所在分组
  dns = ["223.5.5.5", "114.114.114.114"]  # DNS服务器列表，默认使用53端口
  concurrent = true  # 并发请求dns服务器列表

  [groups.dirty]  # 必选分组，匹配GFWList的域名会归类到该组
  # 警告：如果本机的dns指向ts-dns自身，且DoH地址中的域名被归类到该组，则会出现回环解析的情况，此时需要在上面的hosts中指定对应IP
  doh = ["https://dns.quad9.net/dns-query", "https://dns.adguard.com/dns-query", "https://cloudflare-dns.com/dns-query", "https://dns.google/dns-query"]  # dns over https服务器，由于分流到此处的域名大多被墙，需要通过代理访问，所以选择 DNS 远程解析以获取最佳速度
  concurrent = true
```

需要注意的是，如果系统使用了 Systemd-resolved 或其他监听 53 端口的 DNS 解析服务，需要将其停止，否则 Telescope DNS 无法启动。

```shell
# systemctl stop systemd-resolved
# systemctl disable systemd-resolved
```

之后就可以开启 Telescope DNS 并设置自启。

```shell
# systemctl start ts-dns
# systemctl enable ts-dns
```

再之后需要修改 `/etc/netplan/50-cloud-init.yaml` 和 `/etc/resolv.conf`。建议删除原有的 `resolv.conf` 文件并重新创建。

```shell
# vim /etc/netplan/50-cloud-init.yaml
```

```yaml
network:
    ethernets:
        eth0:
            dhcp4: false
            dhcp6: false
            link-local: [] # 停止自动获取 IP 地址
            accept-ra: false # 同时不接受 IPv6 地址的广播
            # optional: true # 值为「真」时，开机时不等待获取到网络。这里作为路由器，我就注释掉了
            addresses:
                - 192.168.0.5/24 # IP 地址，注意有子网长度，相当于 IP 地址 + 子网掩码
            gateway4: 192.168.0.1 # 网关地址
            # nameservers:
                # addresses:
                    # - 192.168.0.1 # DNS 服务器地址
    version: 2
```

```shell
# netplan apply
# rm /etc/resolv.conf
# vim /etc/resolv.conf
```

```
nameserver 127.0.0.1
options edns0
```

配置完成后，可以使用 `dig` 或 `nslookup` 指令检测 DNS 解析是否正常。如出现问题，可以查看日志获取更多信息。

另外，如果执行命令出现 `sudo: unable to resolve host xxx: Temporary failure in name resolution`，可以在 `/etc/hosts` 中将主机名，也就是这里的 `xxx` 添加到 `127.0.0.1` 之后。

## 7. 配置 iptables

iptables 的配置是最关键的一步，只有这里配置完成后，透明代理才能正常使用，少或多一条规则都可能引起很多问题。以下**所有**指令都需要**管理员权限**运行。

配置策略路由：

```shell
ip rule add fwmark 1 table 100 # 一个不可爱的小标记「1」，理论自定义，其他未测试
ip route add local default dev lo table 100
```

配置防火墙：

```shell
iptables -t mangle -N V2RAY
iptables -t mangle -A V2RAY -d 0.0.0.0/8 -j RETURN
iptables -t mangle -A V2RAY -d 10.0.0.0/8 -j RETURN
iptables -t mangle -A V2RAY -d 100.64.0.0/10 -j RETURN
iptables -t mangle -A V2RAY -d 127.0.0.0/8 -j RETURN
iptables -t mangle -A V2RAY -d 169.254.0.0/16 -j RETURN
iptables -t mangle -A V2RAY -d 172.16.0.0/12 -j RETURN
iptables -t mangle -A V2RAY -d 192.0.0.0/24 -j RETURN
iptables -t mangle -A V2RAY -d 192.0.2.0/24 -j RETURN
iptables -t mangle -A V2RAY -d 192.88.99.0/24 -j RETURN
iptables -t mangle -A V2RAY -d 192.168.0.0/16 -j RETURN
iptables -t mangle -A V2RAY -d 198.18.0.0/15 -j RETURN
iptables -t mangle -A V2RAY -d 198.51.100.0/24 -j RETURN
iptables -t mangle -A V2RAY -d 203.0.113.0/24 -j RETURN
iptables -t mangle -A V2RAY -d 224.0.0.0/4 -j RETURN
iptables -t mangle -A V2RAY -d 240.0.0.0/4 -j RETURN
iptables -t mangle -A V2RAY -d 255.255.255.255/32 -j RETURN # 以上均为特殊地址，直连
iptables -t mangle -A V2RAY -p udp --dport 53 -j RETURN # 国内域名查询，直连
iptables -t mangle -A V2RAY -p tcp -j TPROXY --on-port 12345 --tproxy-mark 1
iptables -t mangle -A V2RAY -p udp -j TPROXY --on-port 12345 --tproxy-mark 1 
# 代理需要加一个不可爱的标记
iptables -t mangle -A PREROUTING -j V2RAY

iptables -t mangle -N V2RAY_MARK # 本机代理
iptables -t mangle -A V2RAY_MARK -d 0.0.0.0/8 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 10.0.0.0/8 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 100.64.0.0/10 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 169.254.0.0/16 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 172.16.0.0/12 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 192.0.0.0/24 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 192.0.2.0/24 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 192.88.99.0/24 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 192.168.0.0/16 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 198.18.0.0/15 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 198.51.100.0/24 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 203.0.113.0/24 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 224.0.0.0/4 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 240.0.0.0/4 -j RETURN
iptables -t mangle -A V2RAY_MARK -d 255.255.255.255/32 -j RETURN # 除本机外，其他直连
iptables -t mangle -A V2RAY_MARK -p udp --dport 53 -j RETURN
iptables -t mangle -A V2RAY_MARK -j RETURN -m mark --mark 2 # 打一个可爱的标记
iptables -t mangle -A V2RAY_MARK -p tcp -j MARK --set-mark 1 # 同样需要不可爱的标记
iptables -t mangle -A V2RAY_MARK -p udp -j MARK --set-mark 1
iptables -t mangle -A OUTPUT -j V2RAY_MARK
```

```shell
$ lsmod | grep TPROXY
```

```
…
xt_TPROXY              20480  2
…
```

如未出现此模块，说明系统未自动加载，需要手动设置。

```shell
# modprobe xt_TPROXY
```

之后编辑 `/etc/modules` 设置开机自动加载。

```
…
xt_TPROXY
```

保存并退出即可。

执行上述命令之后，理论上应该成功了，同样可以使用 cURL 进行测试。

```shell
$ curl google.com
```

出现和上文中一样的结果，说明没有问题了。现在只需将局域网内其他设备的网关和 DNS 服务器换成透明代理设备的 IP 即可。如果没有配置成功，那么就再一次阅读上文，检查配置，以及配合搜索引擎解决问题，实在不行可以请求大佬提供帮助。

不过呢，由于最后输入的一大串指令只是临时生效，重启后就需要重新配置，所有我们需要将其保存下来，并编写 Systemd 单元以方便使用。

```shell
# mkdir /etc/iptables
# iptables-save -f /etc/iptables/v2tproxy.rules
# vim /etc/systemd/system/v2tproxy.service
```

```ini
[Unit]
Description=Transparent proxy configurations for V2Ray
After=network.target

[Service]
Type=oneshot
ExecStart=/sbin/ip rule add fwmark 1 table 100 ; /sbin/ip route add local default dev lo table 100 ; /sbin/iptables-restore /etc/iptables/v2tproxy.rules

[Install]
WantedBy=multi-user.target
```

```shell
# systemctl enable v2tproxy
```

至此，一切都大功告成了。

## 参考

1. [TProxy實現透明代理 - 小學霸](https://xuebaxi.com/blog/2019-11-23-01)
2. [Netplan | Backend-agnostic network configuration in YAML](https://netplan.io/)
3. [在 Vim 中优雅地查找和替换 | Harttle Land](https://harttle.land/2016/08/08/vim-search-in-file.html)
4. [在透明代理环境中开放 UDP 53 端口作为 DNS 服务器出现问题 · Issue #1971 · v2ray/v2ray-core](https://github.com/v2ray/v2ray-core/issues/1971)
5. [启用iptables后无法解析域名和ping - tlanyan](https://tlanyan.me/iptables-ping-nslookup/)
6. [Linux使用TPROXY进行UDP的透明代理 - 简书](https://www.jianshu.com/p/76cea3ef249d)
7. [Dokodemo UDP转发导致断流 · Issue #1432 · v2ray/v2ray-core](https://github.com/v2ray/v2ray-core/issues/1432)
8. [Iptables+Tproxy+RedSocks(TCP/UDP)透明代理原理浅析_网络_T3rry'S Blog-CSDN博客](https://blog.csdn.net/ts__cf/article/details/78942294)
9. [Iptables 指南 1.1.19](https://www.frozentux.net/iptables-tutorial/cn/iptables-tutorial-cn-1.1.19.html#IPTABLES-SAVE)
10. [smgate/tcp-config.json at master · MassSmith/smgate](https://github.com/MassSmith/smgate/blob/master/config/tcp-config/树莓派网关v2ray的config.json模板/tcp-config.json)
11. [透明代理(TPROXY) | 新 V2Ray 白话文指南](https://guide.v2fly.org/app/tproxy.html)
12. [使用Ubuntu 18.04打造超级家庭网关（边缘路由器）](https://www.johnrosen1.com/ubuntu-router/)
13. [V2Ray透明代理/透明网关/广告屏蔽/路由器翻墙-荒岛](https://lala.im/6417.html)
14. [Kernel module - ArchWiki](https://wiki.archlinux.org/index.php/Kernel_module#Automatic_module_loading_with_systemd)