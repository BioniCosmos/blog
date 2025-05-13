# Elixir 学习笔记（3）：模式匹配

在我看来，模式匹配是一种强大的配平运算。

<!--more-->

## 匹配运算符

在很多编程语言中，我们将 `=` 称为赋值运算符。

```c
int a = 0;
a = a + 1;
```

而在函数式语言中，`=` 不只赋值。

```elixir
iex> x = 1
1
iex> 1 = x
1
iex> 2 = x
** (MatchError) no match of right hand side value: 1
```

匹配运算符，正如它的名字，可以检测运算符两边是否相匹配。当变量出现在左侧时，匹配运算符还会尝试通过赋值使两边相匹配。

## 模式匹配

只是判断两边是否相等，那么为什么不用比较运算符呢？怎样的表达式能称得上「匹配」？

简单来说，匹配运算符会根据类型、数量、值来判断两边是否匹配；赋值时，不但会尝试使值相等，还会使结构符合一致。例如，我们可以对元组进行模式匹配：

```elixir
iex> {a, b, c} = {:hello, "world", 42}
{:hello, "world", 42}
iex> a
:hello
iex> b
"world"
iex> c
42
```

但两边类型不同时就会出现错误，如元组和列表：

```elixir
iex> {a, b, c} = [:hello, "world", 42]
** (MatchError) no match of right hand side value: [:hello, "world", 42]
```

元组大小也要相等：

```elixir
iex> {a, b, c} = {:hello, "world"}
** (MatchError) no match of right hand side value: {:hello, "world"}
```

值更要相等：

```elixir
iex> {:ok, result} = {:ok, 13}
{:ok, 13}
iex> result
13
iex> {:ok, result} = {:error, 0}
** (MatchError) no match of right hand side value: {:error, 0}
```

再试试对列表进行模式匹配：

```elixir
iex> [a, b, c] = [1, 2, 3]
[1, 2, 3]
iex> a
1
```

最经典的莫过于 cons list 模式匹配：

```elixir
iex> [head | tail] = [1, 2, 3]
[1, 2, 3]
iex> head
1
iex> tail
[2, 3]
```

类似于 `hd/1` 和 `tl/1` 函数，我们无法使用头部和尾部模式匹配来匹配空列表：

```elixir
iex> [head | tail] = []
** (MatchError) no match of right hand side value: []
```

`[head | tail]` 格式不仅可用于模式匹配，还能生成新列表以实现在不可变的情况下向列表前端添加新元素：

```elixir
iex> list = [1, 2, 3]
[1, 2, 3]
iex> [0 | list]
[0, 1, 2, 3]
```

模式匹配使开发者能够轻松解构诸如元组和列表等数据类型。正如我们将在接下来的章节中看到的那样，它是 Elixir 中递归的基础之一，并且适用于其他类型，如映射和二进制。

## 固定运算符

Elixir 中的变量可以被重新绑定：

```elixir
iex> x = 1
1
iex> x = 2
2
```

> **不是说不可变吗？为什么能改变 `x` 的值？**
>
> 重新绑定和改变变量的值完全是两回事，我们不如用既函数式又可变的 Rust 来解释这个问题。
>
> 首先我们写一个循环。
>
> ```rust
> fn main() {
>     let mut i = 0;
>     while i < 5 {
>         println!("{i}");
>         i += 1;
>     }
> }
> ```
>
> 倘若我们不使用 `mut`，而选择重复使用 `let` 来「更新」`i` 呢？
>
> ```rust
> fn main() {
>     let i = 0;
>     while i < 5 {
>         println!("{i}");
>         let i = i + 1;
>     }
> }
> ```
>
> 答案一目了然，在循环作用域内重新定义变量显然不能改变循环外 `i` 的值，因此循环无法正常工作。而 Elixir 语法中无需显式定义或声明变量，所以使答案不是那么明显。此外，从这个例子中我们也能明白为什么 Rust 会允许重复定义变量。
>
> 另外一个能证明重新绑定不是改变值的证据是当定义复合类型时，我们能够更换（重新绑定）整个变量，但不能就地改变这个变量中的某个值。
>
> 那么我们是否有方法在不使用循环的情况下实现类型功能？答案是递归。
>
> ```rust
> fn main() {
>     print(0);
> }
> 
> fn print(i: i32) {
>     if i < 5 {
>         println!("{i}");
>         print(i + 1);
>     }
> }
> ```
>
> ```elixir
> defmodule Count do
>   def print(i) do
>     if i < 5 do
>       IO.puts(i)
>       print(i + 1)
>     end
>   end
> end
> 
> Count.print(0)
> ```

然而，有时我们不希望变量被重新绑定。当你希望对变量的**现有值**进行模式匹配而不是重新绑定变量时，可以使用固定运算符 `^`。

```elixir
iex> x = 1
1
iex> ^x = 2
** (MatchError) no match of right hand side value: 2
```

由于我们使用了固定运算符，所以它相当于以下操作：

```elixir
iex> 1 = 2
** (MatchError) no match of right hand side value: 2
```

我们甚至看到了完全相同的错误消息。

我们可以在其他模式匹配中使用固定运算符，例如元组或列表：

```elixir
iex> x = 1
1
iex> [^x, 2, 3] = [1, 2, 3]
[1, 2, 3]
iex> {y, ^x} = {2, 1}
{2, 1}
iex> y
2
iex> {y, ^x} = {2, 2}
** (MatchError) no match of right hand side value: {2, 2}
```

## 其他

一个变量在单次模式匹配时只允许匹配到相同的值：

```elixir
iex> {x, x} = {1, 1}
{1, 1}
iex> {x, x} = {1, 1.0}
** (MatchError) no match of right hand side value: {1, 1.0}
```

可以使用 `_` 以在匹配时忽略不需要的值，不允许 `_` 作为变量被直接读取：

```elixir
iex> [head | _] = [1, 2, 3]
[1, 2, 3]
iex> head
1
iex> _
error: invalid use of _. _ can only be used inside patterns to ignore values and cannot be used in expressions. Make sure you are inside a pattern or change it accordingly
└─ iex:1

** (CompileError) cannot compile code (errors have been logged)
```

虽然模式匹配非常强大，但仍有限制。例如，匹配运算符的左侧不能是函数调用。

```elixir
iex> length([1, [2], 3]) = 3
error: cannot invoke remote function :erlang.length/1 inside a match
└─ iex:1

** (CompileError) cannot compile code (errors have been logged)
```

但反过来可以：

```elixir
iex> 3 = length([1, [2], 3])
3
```

这就是左值和右值的区别吗？（
