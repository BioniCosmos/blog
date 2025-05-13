# Elixir 学习笔记（1）：介绍

相比与以 C 为代表的指令式编程范式的流行，函数式编程范式显得不那么受重视，但在近几年的编程技术发展中，函数式的比重明显增加。上一篇文章介绍的 Jetpack Compose 就深受函数式的影响，但真正让我眼前一亮的是「求阶乘」。

<!--more-->

求阶乘最简单的方式是递归，让我们用 Rust 编写该程序。

```rust
fn factorial(n: i32) -> i32 {
    if n <= 1 {
        1
    } else {
        n * factorial(n - 1)
    }
}
```

不使用循环和递归如何实现？

```rust
fn factorial(n: i32) -> i32 {
    (1..=n).fold(1, |acc, x| acc * x)
}
```

发生了什么？首先我们创建了一个 range，里面包含了阶乘计算所需的所有乘数，而 `fold` 函数将其中的每一个值 `x` 取出，并在累加器 `acc` 初始值为 `1` 的情况下执行 `acc *= x`，遍历结束后返回最终 `acc` 的值。

还有更简单的方法：

```rust
fn factorial(n: i32) -> i32 {
    (1..=n).product()
}
```

就这么简单，`product` 函数会计算 range 中所有值的积。

这段代码其实是 Rustlings 中的一道题，看到这种写法时瞬间就被函数式、声明式的优雅打动。

![太优雅了！](./elegance-spy-x-family.gif)

并不是说函数式无懈可击，现代编程语言都支持多种编程范式，不同范式各有各的舞台，合理运用他们才能写出更优雅的代码。不过目前接触的语言虽然有很多支持函数式，但主要范式仍为指令式，所以如果想要真正体验完全不同的风格，就要尝试主要范式为函数式的编程语言。Elixir 作为一款与 Go、Rust、Kotlin 同期发布的新兴编程语言，有诸多特性，且能用在实际项目中，那么它是否真的是「灵丹妙药」呢？

## 安装

https://elixir-lang.org/install.html

## 互动模式

接下来让我们正式进入 Elixir。通过 `iex` 程序可以进入 Elixir 互动模式。

```elixir
iex> 1 + 1
2
iex> "Hello" + "World"
** (ArithmeticError) bad argument in arithmetic expression: "Hello" + "World"
    :erlang.+("Hello", "World")
    iex:2: (file)
```

字符串拼接失败了！

```elixir
iex> "Hello" <> "World"
"HelloWorld"
```

原来如此，Elixir 中需要通过 `<>` 运算符拼接字符串。

通过按两次 `Ctrl+C` 即可退出互动模式，接下来让我们试试运行脚本。

## 运行脚本

打开一个文件，在其中写入以下代码。

```elixir
IO.puts("Hello world from Elixir")
```

保存文件为 `simple.exs`，然后用 `elixir` 运行它。

```shellsession
$ elixir simple.exs 
Hello world from Elixir
```

Welcome to Elixir!
