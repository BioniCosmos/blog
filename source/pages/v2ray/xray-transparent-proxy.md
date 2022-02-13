---
title: Xray 配置透明代理
permalink: /v2ray/xray-transparent-proxy/
---
这篇文章旨在记录在 J1900 上安装 Xray 配置透明代理以作为旁路由实现局域网内设备无感翻墙的过程，无意涉及过多细节及原理，操作系统为 Debian 11。

## 配置网络

Debian 11 默认使用 systemd-networkd 和 systemd-resolved 管理网络，为防止干扰，建议停用 systemd-resolved。

```shell-session
# systemctl disable systemd-resolved --now
```

创建 `/etc/systemd/network/eth0.network` 以配置网卡。（`eth0` 为网卡名称，请根据实际情况进行更改，使用指令 `ip link show` 可查看。）

```systemd
[Match]
Name=eth0

[Network]
Address=192.168.0.2/24
Gateway=192.168.0.1
```

编辑 `/etc/sysctl.conf` 配置包转发。

```ini
…
# Uncomment the next line to enable packet forwarding for IPv4
net.ipv4.ip_forward=1
…
```

```shell-session
# sysctl -p
```

运行该指令后，配置立即生效。

如果想让透明代理生效，还应配置策略路由。传统的方法是使用指令来配置，实际上 systemd-networkd 同样可以，且方便管理，只需创建 `/etc/systemd/network/lo.network`。

```systemd
[Match]
Name=lo

[Route]
Destination=0.0.0.0/0
Table=100
Type=local

[RoutingPolicyRule]
FirewallMark=1
Table=100
```

```shell-session
# systemctl restart systemd-networkd
```

这里由于修改了 IP，如果使用 SSH 连接此时可能会断开，重连即可。

## 安装并配置 Xray

```shell-session
# useradd -Mrs /usr/sbin/nologin xray
# bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install -u xray --without-geodata
# wget -P /usr/local/share/xray/ https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/{geoip.dat,geosite.dat}
```

以上指令将会安装 Xray 并使其以 `xray` 用户运行，这将会在后续配置中起到作用；同时会使用加强版的路由规则文件 [Loyalsoldier/v2ray-rules-dat](https://github.com/Loyalsoldier/v2ray-rules-dat) 代替默认的。

编辑 Xray 配置文件：`/usr/local/etc/xray/config.json`。（请按照实际情况将 `example.com`、`192.0.2.1` 和 `UUID` 替换为服务端域名、服务端 IP 地址和用户 ID。）

```json
{
    "inbounds": [
        {
            "tag": "dns-in",
            "port": 53,
            "protocol": "dokodemo-door",
            "settings": {
                "network": "tcp,udp",
                "address": "8.8.8.8",
                "port": 53
            }
        },
        {
            "listen": "127.0.0.1",
            "port": 7000,
            "protocol": "dokodemo-door",
            "settings": {
                "network": "tcp,udp",
                "followRedirect": true
            },
            "sniffing": {
                "enabled": true,
                "destOverride": [
                    "fakedns"
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
            "settings": {
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
            }
        },
        {
            "tag": "proxy",
            "protocol": "vless",
            "settings": {
                "vnext": [
                    {
                        "address": "example.com",
                        "port": 443,
                        "users": [
                            {
                                "id": "UUID",
                                "encryption": "none",
                                "flow": "xtls-rprx-direct"
                            }
                        ]
                    }
                ]
            },
            "streamSettings": {
                "security": "xtls",
                "sockopt": {
                    "domainStrategy": "UseIPv4"
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
        },
        {
            "tag": "dns-out",
            "protocol": "dns",
            "proxySettings": {
                "tag": "proxy"
            }
        }
    ],
    "dns": {
        "hosts": {
            "example.com": "192.0.2.1",
            "geosite:category-ads-all": "127.0.0.1"
        },
        "servers": [
            "119.29.29.29",
            "223.5.5.5",
            {
                "address": "fakedns",
                "domains": [
                    "geosite:geolocation-!cn"
                ]
            }
        ],
        "queryStrategy": "UseIPv4"
    },
    "routing": {
        "domainStrategy": "IPIfNonMatch",
        "rules": [
            {
                "type": "field",
                "inboundTag": [
                    "dns-in"
                ],
                "outboundTag": "dns-out"
            },
            {
                "type": "field",
                "domain": [
                    "geosite:category-ads-all"
                ],
                "outboundTag": "block"
            },
            {
                "type": "field",
                "domain": [
                    "geosite:geolocation-!cn"
                ],
                "outboundTag": "proxy"
            },
            {
                "type": "field",
                "ip": [
                    "geoip:telegram"
                ],
                "outboundTag": "proxy"
            }
        ]
    }
}
```

```shell-session
# systemctl restart xray
```

## 配置 Netfilter

编辑 `/etc/nftables.conf`。

```
#!/usr/sbin/nft -f

flush ruleset

define RESERVED_IPV4_ADDR = {
    10.0.0.0/8,
    100.64.0.0/10,
    127.0.0.0/8,
    169.254.0.0/16,
    172.16.0.0/12,
    192.0.0.0/24,
    192.88.99.0/24,
    192.168.0.0/16,
    224.0.0.0/4,
    240.0.0.0/4,
    255.255.255.255/32
}

table ip xray4 {
    chain prerouting {
        type filter hook prerouting priority mangle;
        ip daddr $RESERVED_IPV4_ADDR return
        meta l4proto { tcp, udp } tproxy to 127.0.0.1:7000 meta mark set 1
    }
    chain output {
        type route hook output priority mangle;
        ip daddr $RESERVED_IPV4_ADDR return
        meta skuid xray return
        meta l4proto { tcp, udp } meta mark set 1
    }
    chain postrouting {
        type nat hook postrouting priority srcnat;
        masquerade
    }
}
```

使规则生效并设置开机自启。

```shell-session
# systemctl enable nftables --now
```

## 配置设备网络

修改 `/etc/resolv.conf`。

```
nameserver 192.168.0.2
```

将需要被代理的设备的网关和 DNS 服务器地址改为旁路由 IP 地址（文中为 `192.168.0.2`）即可。
