# 不変の魔術：State Monad

仅使用不变量和函数就能模拟出全局可变状态？这真的不是魔法吗？

<!--more-->

让我们先来看一段 Haskell 代码：

```haskell
module Main where

import Control.Monad.State

add :: Int -> StateT Int IO ()
add x = do
  s <- get
  let s' = s + x
  put (s + x)
  lift $ putStrLn ("counter: " ++ show s')

count :: StateT Int IO ()
count = do
  add 1
  add 100
  add (-10)

main :: IO ()
main = do
  final <- execStateT count 0
  putStrLn ("final state: " ++ show final)

-- 运行结果：
-- counter: 1
-- counter: 101
-- counter: 91
-- final state: 91
```

这是一个简单的计数器程序。它定义了一个 `add` 操作，每次调用时会更新计数器并打印当前值。`count` 函数则按顺序调用了三次 `add`。最后 `main` 函数以初始状态 `0` 启动这个计数过程，并打印出最终的状态 `91`。

神奇之处在于，`add` 和 `count` 函数看起来就像在操作一个可变的全局变量，但是，Haskell 的核心特性之一就是不可变性，所以代码中并没有真正修改任何变量，那么，这种状态管理是如何实现的呢？

答案就是我们今天的主题⸺state monad。本文将通过从头实现 state monad 来揭示其工作原理，让你也学会施展这基于函数的魔法。

## 辗转于函数之间

首先，让我们用最简单但也最繁琐的方式去实现与上面例子功能类似的计数器。由于 IO 操作在 Haskell 中相对复杂，为更好理解重点，我们将两函数改为返回需要输出的字符串而非直接调用 `putStrLn` 进行输出：

```haskell
add :: Int -> Int -> (String, Int)
add x s = ("counter: " ++ show s', s') where s' = s + x

count :: Int -> [String]
count s = do
  let (a, s') = add 1 s
  let (a', s'') = add 100 s'
  let (a'', s''') = add (-10) s''
  [a, a', a'']
```

这段代码清晰地展示了状态传递的过程：每个 `add` 函数调用都接收前一个状态，并返回一个新的状态，这个新状态再被传递给下一个函数。如此进行状态管理虽简单易懂，但当操作逻辑变得复杂时，这种手动「穿针引线」式地传递方式便会变得非常繁琐且容易出错。因此，我们希望能够隐藏这些机械重复的状态传递逻辑，让代码更聚焦于业务逻辑本身。要实现这一点，需要解决两个核心问题：

1. 抽离状态传递
2. 组合状态转换

下面就让我们看看 state monad 是如何巧妙解决这两个问题的。

## 本质是函数

要理解 monad，关键在于理解其结构本身和 _bind_ 运算。我们先来看看 state monad 的结构：

```haskell
type State s a = s -> (a, s)
```

不愧是函数式编程，`State` 竟是一个函数。是不是有些眼熟？回想之前的 `add` 函数签名：

```haskell
add :: Int -> Int -> (String, Int)
```

如果对其进行部分应用（partial application），只提供第一个参数 `x`，如 `add 1`：

```haskell
add1 :: Int -> (String, Int)
add1 = add 1
```

这不就是 `State Int String` 吗？也就是说，`State` 其实是对状态转换过程的抽象，其内部存储着形如 `add` 的状态转换函数，只要给它一个初始状态 `s`，它就能执行计算，产生一个结果 `a` 和下一个状态 `s`。

## 关键在组合

只进行一次状态转换显然用处不大，所以我们需要将多个转换函数组合到一起。

一个简单的想法是实现一个组合函数，它首先接收一个 `State s a` 并运行，获得一个新状态，然后再接收一个 `State s b` 并利用刚刚得到的状态值运行这个转换函数，这样又会得到另一个新的状态，最后再把整个过程包装起来，使这个组合函数返回一个新的 `State s b`，运行多次组合函数，便能将多个转换函数串联在一起。

```haskell
productR :: State s a -> State s b -> State s b
productR ma mb = mb . snd . ma
```

之后并可以使用 `productR` 组合 `add` 以实现 `count`：

```haskell
count :: State Int String
count = productR (productR (add 1) (add 100)) (add (-10))
```

不过，无论从代码逻辑还是类型上都可以看出，前两次对 `add` 调用后的返回结果都被抛弃掉了，我们只能获得最后一次的结果，而在之前的手动传递状态实现中，保留所有调用结果是必要的，因此，我们需要增强组合方法。具体来说，增强后的组合函数不直接接收第二个转换函数 `State s b`，转而接收一个函数 `f :: a -> State s b`。

```haskell
bind :: State s a -> (a -> State s b) -> State s b
bind m f = \s -> let (a, s') = m s in f a s'
```

看起来 `bind` 相比 `productR` 并没有复杂多少，无非是让第一个转换函数的结果有了去处，但这个看上去小小的也很可爱的 `f` 却给了我们无限的发挥空间。

你可以像使用 `productR` 一样使用 `bind`，直接抛弃每一步的结果：

```haskell
count :: State Int String
count = bind (bind (add 1) (\_ -> add 100)) (\_ -> add (-10))
```

也可以使用这些结果，并不断传递下去：

```haskell
count :: State Int [String]
count =
  bind
    ( bind
        (bind (add 1) (\a -> \s -> ([a], s)))
        (\a -> bind (add 100) (\a' -> \s -> (a ++ [a'], s)))
    )
    (\a -> bind (add (-10)) (\a' -> \s -> (a ++ [a'], s)))
```

所以为什么不直接通过嵌套的闭包保存结果呢？

```haskell
count :: State Int [String]
count =
  bind (add 1) $ \a ->
    bind (add 100) $ \a' ->
      bind (add (-10)) $ \a'' ->
        \s -> ([a, a', a''], s)
```

这些不过是拙劣的例子罢了，总之，你可以在 `f` 中编写任何逻辑，只要最后返回一个 `State` 就好。使用 `bind`，你便能组合起一个世界。

万事俱备矣。

## 流水线

使用组合函数，我们将几个「小」转换函数 `add` 组装成「大」转换函数 `count`，现在的 `count` 就如同工厂中一条流水线，其内部由多个负责不同功能的生产单位依次排列组合而成，这时，只需在输入端提供一个初始状态，流水线便会开始工作，顷刻间便能从输出端得到结果。

更重要的是，转换函数具有组合性与复用性。「小」转换函数可以是「大」流水线，「大」转换函数也可以是「小」生产单位；每个转换函数都可以多次调用，并可以根据实际逻辑传入不同初值；即使一个转换函数在某条流水线中不再被需要，它也随时能被部署到另一条需要它的流水线中继续发光发热。

这种将复杂问题分解为独立、可复用、可组合的纯函数单元，正是函数式编程的核心魅力所在。它鼓励我们构建模块化、易于理解和维护的系统。

```
ghci> count 0
(["counter: 1","counter: 101","counter: 91"],91)
```

```
> count()(0)
[ [ 'counter: 1', 'counter: 101', 'counter: 91' ], 91 ]
```

总结一下，state monad 的核心原理是使用函数封装状态转换过程，再用组合函数将多个转换函数组合为更大的转换函数。如果你还尚未完全理解其要义，不妨回过头再读一遍。接下来，我们将对这个基础实现进行改进，让它更符合标准，也更易使用。

## 加料

总是手动编写转换函数令人感到繁琐，我们可以通过一些辅助函数来简化代码。

```haskell
pure :: a -> State s a
pure a = \s -> (a, s)

get :: State s s
get = \s -> (s, s)

put :: s -> State s ()
put s = const ((), s)

modify :: (s -> s) -> State s ()
modify f = \s -> ((), f s)
-- modify f = bind get (put . f)

gets :: (s -> a) -> State s a
gets f = \s -> (f s, s)
-- gets f = bind get (pure . f)
```

分别解释一下各自的作用：

- `pure`：将一个普通值包装成 `State`（转换函数结果），不影响状态。
- `get`：获取当前状态（将状态放入转换函数结果中，但不改变状态）。
- `put`：使用新值覆盖当前状态。
- `modify`：与 `put` 一样同用于修改状态，但接受一个函数，这样可根据当前状态来更新状态。可视为 `get` 与 `put` 的组合。
- `gets`：与 `get` 一样同用于获取状态，但会对结果应用一个传入的函数而不是直接返回。

这些函数本身都是转换函数，所以可以与 `productR`、`bind` 结合使用。

有了这些工具，我们可以重写 `add` 和 `count`，让它们更简洁、更具表达力：

```haskell
add :: Int -> State Int String
add x = productR (modify (+ x)) (gets (("counter: " ++) . show))
-- add x = bind get $ \s ->
--   let s' = s + x in productR (put s') (pure ("counter: " ++ show s'))

count :: State Int [String]
count =
  bind (add 1) $ \a ->
    bind (add 100) $ \a' ->
      bind (add (-10)) $ \a'' ->
        pure [a, a', a'']
```

代码逻辑是不是清晰了很多？现在，我们可以通过这些工具函数去操控「全局变量」，而不用手动编写转换函数以及相关逻辑。这就是很好的抽象。

## 类型

到目前为止，我们的 `State` 定义只是一个类型别名，这在简单场景下可行，但存在一些问题：

1. 类型别名并非独立类型，缺乏安全性。
2. 类型别名无法「实现 `Monad`」。
3. 当前定义无法与其他 monad 深度结合。

下面将详细探讨这三个问题。

### 独立类型

在 Haskell 编译器看来，当前的 `State` 与一个 `s -> (a, s)` 普通函数别无二致，因为 `State` 只是一个类型别名。而如果把 `State` 定义为独立类型，就可以增强类型安全性，防止类型混淆，增加抽象与封装，让错误尽量在编译时被检测出来。

不过这也会降低灵活性并增加复杂程度，我们需要通过数据构造器构造和匹配 `State` 才能创建和访问其中转换函数，并且也无法直接将 `add` 函数作为 `State` 使用了。

下面来看看改造后的代码：

```haskell
newtype State s a = State (s -> (a, s))

pure :: a -> State s a
pure a = State (\s -> (a, s))

productR :: State s a -> State s b -> State s b
productR (State ma) (State mb) = State (mb . snd . ma)

bind :: State s a -> (a -> State s b) -> State s b
bind (State m) f = State $ \s ->
  let (a, s') = m s
      (State mb) = f a
   in mb s'

get :: State s s
get = State (\s -> (s, s))

put :: s -> State s ()
put s = State (const ((), s))

modify :: (s -> s) -> State s ()
modify f = State (\s -> ((), f s))

gets :: (s -> a) -> State s a
gets f = State (\s -> (f s, s))
```

复杂了好多呢。

> 有关 Haskell 类型定义相关的更多内容可参考本文附录《[关于 Haskell 类型定义](/haskell-type-definitions)》。

### 实现类型类

我们无疑已经成功实现 state monad 的核心，但在 Haskell 中，`State` 其实还不算 monad，因为它没有实现 `Monad` 这个类型类（type class），不是 `Monad` 的实例（instance）。所谓类型类与其他语言中的特征（trait）、协议（protocol）、接口（interface）类似，只有让 `State` 实现 `Monad`，它才能更好地与 Haskell 的各种库相交互，同时还能享受到类型类中的众多默认实现函数（如 `*>`/`productR`）。

想实现 `Monad`，须先实现 `Applicative`；想实现 `Applicative`，须先实现 `Functor`。

```haskell
instance Functor (State s) where
  fmap f (State m) = State (\s -> let (a, s') = m s in (f a, s'))

instance Applicative (State s) where
  pure a = State (\s -> (a, s))
  (State mf) <*> (State ma) = State $ \s ->
    let (f, s') = mf s
        (a, s'') = ma s'
     in (f a, s'')

instance Monad (State s) where
  (State m) >>= f = State $ \s ->
    let (a, s') = m s
        State mb = f a
     in mb s'
```

首先要注意到的是，我们实际上是为 `State s` 这个类型构造器实现了各类型类，而不是 `State` 或 `State s a`，因为实现的类型类以及其中的函数会涉及到值与类型的转换，所以不能只为某个具体类型实现，而要为类型构造器实现。另一方面，这些转换只会作用于状态函数的结果 `a`，不会改变状态 `s`。综上，让 `State s` 类型构造器成为各类型类的实例是极为合适的。

接着我们来看各具体表现。对于 `Functor` 中的 `fmap` 函数，其作用为将一个普通函数映射到容器内部的值上，而在 `State` 中则体现为对状态函数结果应用一个函数，这有点像 `gets`，也可以说是 `bind` 的普通函数版（传入的函数的返回值类型不是 `State`，所以不能像 `bind` 一样嵌套使用）。

`Applicative` 的 `pure` 函数只是简单的对一个普通值进行包装，在「辅助函数」部分我们已经实现过了；至于 `<*>`，我们可以称其为「_apply_」或「_ap_」操作，其作用为对容器内的值应用被包装的函数，在 `State` 体现为通过运行被包装的函数和被包装的值，解出他们后将函数应用与值上，在这个过程中状态依次传递。顺带一提，`*>`，也就是 `productR`，在 `Applicative` 有默认实现，所以可以免于手动实现。

至于 `Monad` 和 `>>=`，我们已经很熟悉了，`bind` 就是 `>>=`，它为我们提供了根据前一个计算的结果决定执行下一个计算的能力，这是处理依赖的上下文计算的关键。

总体来说，`Functor` 提供了处理单个容器值的能力，但不能组合多个容器值或依赖前一个结果；`Applicative` 可以组合多个独立的容器计算的结果，但组合的结构和顺序是固定的，不依赖于中间结果；`Monad` 则结合了前两者，提供了强大而灵活的组合能力，并可根据上下文决定计算方向。

另外值得一提的是，`*>`、`>>=` 等函数都默认被定义为中缀运算符，相比于前缀调用，中缀调用改变了运算优先级顺序，减少了括号嵌套，使代码阅读和编写线性化，更符合人类思维习惯。

话不多说，让我们看看实际效果：

```haskell
add :: Int -> State Int String
add x = modify (+ x) *> gets (("counter: " ++) . show)

count :: State Int [String]
count =
  add 1 >>= \a ->
    add 100 >>= \a' ->
      add (-10) >>= \a'' ->
        pure [a, a', a'']

stateOnlyCount :: State Int String
stateOnlyCount = add 1 *> add 100 *> add (-1)
```

> **`*>` 是如何被自动实现的？**
>
> `Applicative` 中对 `*>` 的默认实现如下：
>
> ```haskell
> (*>) :: f a -> f b -> f b
> a1 *> a2 = (id <$ a1) <*> a2
> ```
>
> 下面解释这个实现的实际执行过程。首先，`(<$) = fmap . const`，也就是说，它是 `fmap` 的一种特殊形式，会用传入的值直接替换容器内的值。所以，`id <$ a1` 就是将 `a1` 中的值替换为 `id` 函数。
>
> 然后我们把这个用容器包裹的 `id` 函数以及 `a2` 传入 `<*>`，而 `<*>` 会将 `id x = x` 应用于 `a2` 中的值，故 `a2` 原封不动。
>
> 总结一下，通过将 `a1` 替换为 `id`，然后将 `id` 应用于 `a2` 便实现了对 `a1` 的忽略。放在 `State` 中，执行 `a1` 后的返回状态会传递给 `a2`，但执行结果会被忽略。

### Monad 转换器

此前，为了简化讨论并聚焦于 state monad 的核心机制，我们有意避开了 Haskell 中处理 IO 的复杂性。我们让 `add` 函数直接返回当前计数信息，但我们实际希望能在状态转换的同时执行像打印这样的 IO 操作。现在，我们将着手解决这个问题。

在 Haskell 中，为了维护其核心的「纯函数」理念，所有可能产生副作用的操作（如文件读写、网络通信、输入输出等）都被包装在 IO monad 中。这意味着，如果想在我们的 `State` 计算流程中执行 IO 操作，就必须以某种方式将 `IO` 类型引入进来。

设 `m` 为我们想要结合进来的 monad（如 `IO`），如何才能将 `m` 融入到 `State` 的 `s -> (a, s)` 之中？

最容易想到的方案可能是 `s -> (m a, s)`，我们用 `m` 去包装转换函数的结果。让我们尝试用这种方案修改 `add` 和 `count`：

```haskell
add :: Int -> State Int (IO ())
add x = modify (+ x) *> gets (putStrLn . ("counter: " ++) . show)

count :: State Int (IO ())
count = add 1 *> add 100 *> add (-10)
```

这段代码编译起来没有问题，看起来似乎可以在每次 `add` 时执行打印。但当我们实际运行它时：

```
ghci> let State m = count in fst (m 0)
counter: 91
```

为什么只有最后一次输出？前两次呢？

简单来说，只有将 IO monad 与 Haskell 的运行时直接关联（通过 `main` 函数或 GHCi）时才能实际执行 IO 操作。为保证纯粹性，与 `State` 类似，IO 相关函数调用时只是在「预订」IO 操作，正如当我们手动向某个 `State` 中传入初值时才会实际执行各种定义好的运算一样，只有将提前在代码中定义好的 `IO` 序列通过程序入口传递给运行时，实际 IO 操作才会被执行，而那些不在这条执行链上的 IO 操作是不会被执行的。

回到上面的例子，`count` 中使用的 `*>` 会丢弃前一个操作的结果，所以，`add 1` 和 `add 100` 这两次所返回的 `IO` 就被丢弃了，只有 `add (-10)` 所返回的 `IO` 被保留了下来，并最终在 GHCi 中被求值（evaluate）和输出（print）。

再来看看另一个方案 `s -> m (a, s)`，在这种结构下，每次调用状态函数得到的结果就是一个 `m` 类型的值（如 `IO (a, s)`）。而这种将一个 monad 的功能叠加到另一个之上形成一个新 monad 的结构就被称为 monad 转换器 (monad transformer)。

```haskell
import Control.Monad.Trans

newtype StateT s m a = StateT (s -> m (a, s))

instance (Functor m) => Functor (StateT s m) where
  fmap f (StateT m) = StateT (fmap (\(a, s) -> (f a, s)) . m)

instance (Monad m) => Applicative (StateT s m) where
  pure a = StateT (\s -> pure (a, s))
  (StateT mf) <*> (StateT ma) = StateT $ \s ->
    mf s >>= \(f, s') ->
      ma s' >>= \(a, s'') ->
        pure (f a, s'')

instance (Monad m) => Monad (StateT s m) where
  (StateT m) >>= f = StateT $ \s ->
    m s >>= \(a, s') -> let StateT mb = f a in mb s'

instance MonadTrans (StateT s) where
  lift m = StateT (\s -> fmap (\a -> (a, s)) m)
```

这段代码中，我们定义了基于 `State` 的 monad 转换器 `StateT`（「T」代表 **T**ransformer）并同样为其实现了 `Functor`、`Applicative` 以及 `Monad`。实现思路与之前类似，只不过需要借助容器 `m` 的各种操作函数实现来操作其中包装的 `(a, s)`，所以，类似 `pure a = StateT (\s -> pure (a, s))` 并不（一定）是递归调用，而是多态（根据不同实例类型调用不同的实际函数实现）。

除此之外，我们还为 `StateT` 实现了 `MonadTrans` 类型类（**Monad** **Trans**former）和其中的 `lift` 函数。`lift` 能够将 monad `m`「提升」到 `StateT` 中，使我们能在状态函数中使用 `m`。实现方法为将 `m` 中的 `a` 替换为状态函数的返回结构 `(a, s)`，然后将替换结果 `m (a, s)` 作为函数返回值，最终形成 `s -> m (a, s)`。

这里还有一些辅助类型与函数的实现：

```haskell
import Data.Functor.Identity

type State s = StateT s Identity

state :: (Applicative m) => (s -> (a, s)) -> StateT s m a
state = StateT . (pure .)

get :: (Applicative m) => StateT s m s
get = state (\s -> (s, s))

put :: (Applicative m) => s -> StateT s m ()
put s = state (const ((), s))

modify :: (Applicative m) => (s -> s) -> StateT s m ()
modify f = state (\s -> ((), f s))

gets :: (Applicative m) => (s -> a) -> StateT s m a
gets f = state (\s -> (f s, s))
```

类型方面，`State` 是一个类型别名，其作用与之前的 `State` 类型相同，可用于单纯的状态转换场景。它的实现基于 `StateT`，并借助 `Identity` 这个特殊的透明 monad（`newtype Identity a = Identity { runIdentity :: a }`）将 `StateT` 还原为 `State`。之所以将 `State` 定义为类型别名是因为 `State` 只是一种特殊的 `StateT`，它与 `StateT` 的一切都是兼容的，并非独立类型，也不存在数据构造器。

函数方面，`state` 能让我们免于手动使用 `pure` 对状态函数返回值进行包装，接下来四个熟悉的辅助函数中就使用了 `state`，对于他们的作用就不多加介绍了。

有了 `StateT`，我们终于可以实现边计算、边输出了：

```haskell
add :: Int -> StateT Int IO ()
add x = modify (+ x) *> get >>= \a -> lift (putStrLn ("counter: " ++ show a))

count :: StateT Int IO ()
count = add 1 *> add 100 *> add (-10)
```

最后看一下运行效果：

```
ghci> let StateT m = count in fmap fst (m 0)
counter: 1
counter: 101
counter: 91
```

## 吃糖！

有了 monad 转换器后，我们终于可以将 state monad 与 IO monad 结合使用了，但回头去看本文第一段代码，貌似好像还是有些看不懂喵？没关系，只要吃下这颗甜甜的 do notation 语法糖后你就能明白这一切啦。

do notation 是 Haskell 中用于以一种更易读的、类似指令式编程风格的方式来编写和组合 monadic 计算的语法糖。除了最开始的代码外，「手动传递状态」的代码示例中也同样用到了 do notation。

再来看看下面这段用 do notation 重写的代码（只展示有变动的部分）：

```haskell
instance (Monad m) => Applicative (StateT s m) where
  (StateT mf) <*> (StateT ma) = StateT $ \s -> do
    (f, s') <- mf s
    (a, s'') <- ma s'
    pure (f a, s'')

instance (Monad m) => Monad (StateT s m) where
  (StateT m) >>= f = StateT $ \s -> do
    (a, s') <- m s
    let StateT mb = f a
    mb s'

add :: Int -> StateT Int IO ()
add x = do
  modify (+ x)
  a <- get
  lift (putStrLn ("counter: " ++ show a))

count :: StateT Int IO ()
count = do
  add 1
  add 100
  add (-10)
```

毫无疑问，重写前后的代码等价，只要你已经理解重写前的代码，对比之后基本就能明白 do notation 的转换规则。

总结一下，有以下四点：

1. 转换 `>>=`

   ```haskell
   bindExample = do
     x <- action
     …

   ⬇

   bindExample = action >>= \x -> do { … }
   ```

2. 转换 `*>`

   ```haskell
   productRExample = do
     action
     …

   ⬇

   productRExample = action *> do { … }
   ```

3. 转换 `let`

   ```haskell
   letExample = do
     let x = foo
     …

   ⬇

   letExample = let x = foo in do { … }
   ```

4. 返回值

   ```haskell
   returnExample = do
     x

   ⬇

   returnExample = x
   ```

do notation 虽甜，但也不能乱吃哦。这篇名为「[Do Notation Considered Harmful](https://wiki.haskell.org/Do_notation_considered_harmful)」的文章中展示一些不当用例，建议阅读。

现在想必你一定能看懂最初的代码了。

## 其他的例子

既然已经知道了 state monad 的原理，我们就可以抛弃自己造的轮子，改为使用更成熟的实现。现在，让我尝试一些更为实际的例子。

### 斐波那契数列

用尾递归或循环迭代的方式编写「求斐波那契数列第 n 项」的程序时需要维护两个不断修改的整数状态，既然涉及到状态改变，那么就可以用 state monad 去实现。

```haskell
import Control.Monad.State

fib :: Int -> Integer
fib n = evalState (fibM n) (0, 1)
  where
    fibM :: Int -> State (Integer, Integer) Integer
    fibM 0 = gets fst
    fibM 1 = gets snd
    fibM n = fibM (n - 1) *> modify (\(a, b) -> (b, a + b)) *> gets snd
```

> `evalState`/`evalStateT` 的作用是获取转换函数执行后返回的元组中的第一项，即计算结果。

在这个实现中，我们采用了一种先递归到最底层，再从下往上不断迭代更新状态的方式去计算结果，第 0 项与第 1 项通过初值提前设定好，其他项在递归返回后通过 `modify` 进行不断更新，最终返回到最上层时，就得到了第 n 项。

| `fibM n` | 状态               | 返回结果 |
| -------- | ------------------ | -------- |
| `fibM 3` | `(0, 1)`           |          |
| `fibM 2` | `(0, 1)`           |          |
| `fibM 1` | `(0, 1)`           | 1        |
| `fibM 2` | `(0, 1) -> (1, 1)` | 1        |
| `fibM 3` | `(1, 1) -> (1, 2)` | 2        |

可以看到，这个的代码中 `gets snd` 出现了两次，实际运行时每次递归也都会调用，有没有什么办法可以将其简化呢？

```haskell
fib :: Int -> Integer
fib n = evalState (fibM n) (0, 1)
  where
    fibM :: Int -> State (Integer, Integer) Integer
    fibM 0 = gets fst
    fibM 1 = gets snd
    fibM n = modify (\(a, b) -> (b, a + b)) *> fibM (n - 1)
```

在这个新实现中，我们改变了递归与更新的顺序，在第 1 次进入 `fibM` 时，虽执行的是 `fibM n`，但实际上计算的是 `fib 2` 的值；到第 n 次进入 `fibM` 时，此时执行的却是 `fibM 1`，`fib n` 的值已计算完毕，此时调用一次 `gets snd` 直接返回结果即可。

| `fibM n` | 状态               | 返回结果 |
| -------- | ------------------ | -------- |
| `fibM 3` | `(0, 1) -> (1, 1)` |          |
| `fibM 2` | `(1, 1) -> (1, 2)` |          |
| `fibM 1` | `(1, 2)`           | 2        |
| `fibM 2` | `(1, 2)`           | 2        |
| `fibM 3` | `(1, 2)`           | 2        |

### 括号匹配

检查一个字符串中的括号是否正确匹配（例如 `{[()]}` 合法，`{[(]})` 或 `((` 非法）是一个经典问题，解决这个问题的标准算法是使用一个栈：

1. 遍历字符串中的每个字符。
2. 如果遇到左括号（`(`、`[`、`{`），将其入栈。
3. 如果遇到一个右括号（`)`、`]`、`}`），检查栈是否为空：
   - 空，字符串非法；
   - 非空，栈顶元素出栈，检查弹出的左括号是否与当前右括号匹配：
     - 匹配，继续遍历；
     - 不匹配，字符串非法。
4. 整个字符串遍历结束后，检查栈是否为空：
   - 空，所有括号已成功匹配，字符串合法；
   - 非空，存在尚未匹配的左括号，字符串非法。

既然需要不断改变栈的状态，那么 state monad 就可以派上用场了。此外，匹配存在失败的可能性，而 maybe monad 很适合这种场景，两者结合，就能够实现当失败时立即退出计算。

以下是实现代码：

```haskell
import Control.Monad
import Control.Monad.State
import Data.Foldable

isBalanced :: String -> Bool
isBalanced xs = execStateT (traverse_ check xs) [] == Just []

check :: Char -> StateT [Char] Maybe ()
check x
  | x `elem` "([{" = modify (x :)
  | x `elem` ")]}" = do
      (y : ys) <- get
      put ys
      guard (isMatch y x)
  | otherwise = pure ()

isMatch :: Char -> Char -> Bool
isMatch '(' ')' = True
isMatch '[' ']' = True
isMatch '{' '}' = True
isMatch _ _ = False
```

我们先来看 `check` 函数，它是算法的核心，用来处理单个字符。当字符属于左括号时，通过 `modify` 将其入栈；当属于右括号时，会通过 `get` 与 `put` 尝试弹出一个左括号，并检查两括号是否匹配；若为其他字符则忽略。

这里有很多细节，首先是 `guard` 函数：

```haskell
guard :: (Alternative f) => Bool -> f ()
guard True = pure ()
guard False = empty
```

结合上下文，`guard (isMatch y x)` 是如果匹配成功返回 `Just ()`，匹配失败返回 `Nothing`。

另外，代码中虽没有体现对于空栈时匹配失败的处理方式，但实际上失败时会自动返回 `Nothing`，这是 do notation、`MonadFail` 与 `Maybe` 三者相结合所产生神奇效果，这里不做过多介绍。

那么 `check` 函数是如何被调用的呢？这要归功于 `traverse_` 函数，它会分别将字符串中的每一个字符传入 `check` 中，并将所有调用连接起来，假设字符串为 `[()]`，展开后就会变成 `check '[' *> check '(' *> check ')' *> check ']'`，再把这串转换函数传入 `execStateT`，它会运行转换函数并返回最终状态，最后我们只需检查最终状态是否为空栈即可得出结果。

这个例子很好地展示了 monad 转换器的强大之处，也告诉我们函数式编程中的诸多概念并非纸上谈兵。

## 总结

> 「我只感觉到麻烦。」
>
> ~~人，人家才不会喜欢呢！（すく～ ❤️）~~
