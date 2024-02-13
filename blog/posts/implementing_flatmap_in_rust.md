---
title: Implementing flat_map in Rust
description: An implementation of flat_map in Rust 
date: 2020-06-22
excerpt: Not too long ago I happened to watch <a href="https://www.youtube.com/channel/UC_iD0xppBwwsrM9DegC5cQQ" target="_blank">@jonhoo</a>'s Crust of Rust <a href="https://www.youtube.com/watch?v=yozQ9C69pNs" target="_blank">stream on iterators</a>. He implemented the standard library function <code><a href="https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.flatten" target="_blank">flatten</a></code> and along the way explained bits and pieces of Rust's trait system. In the stream, he recommends implementing <code><a href="https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.flat_map" target="_blank">flat_map</a></code> as a way to better understand traits. So, here we are!
---

# Implementing flat_map in Rust

Not too long ago I happened to watch [@jonhoo](https://www.youtube.com/channel/UC_iD0xppBwwsrM9DegC5cQQ)'s Crust of Rust [stream on iterators](https://www.youtube.com/watch?v=yozQ9C69pNs). He implemented the standard library function {% anchored-code "flatten" "https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.flatten" %} and along the way explained bits and pieces of Rust's trait system. In the stream, he recommends implementing {% anchored-code "flat_map" "https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.flat_map" %} as a way to better understand traits. So, here we are!

First let's try to understand what `flat_map` is and why it's useful. Then I'll show you how I implemented it, explaining my thought process along the way. I'm assuming that you've coded in Rust before and are familiar with iterators and traits.

## What in the world is `flat_map`?

Most of us are familiar with the concept of mapping. For every element in a collection, apply a function that transforms the element, collect the transformed values, and return the transformed collection. 

To put it more formally, given a collection $[a]$ and a function $f: a \rightarrow b$, $map([a]) = [b]$, where $a$ and $b$ are types.

Alright, now what's the deal with `flat`? Let's try to understand it through an example.

Let's say I have a list of elements $A = [[1,2], [3, 4, 5]]$. Flattening $A$ will give me the list $[1, 2, 3, 4, 5]$. To put it simply, `flat` removes nesting from collections. The level of nesting removed depends on the implementation of the function. In Javascript's {% anchored-code "Array.prototype.flat" "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat" %}, you can specify how deep a nested structure should be flattened by passing in a `depth` parameter. In Rust, the standard library function {% anchored-code "flatten" "https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.flatten" %} will remove only one level of nesting.

Now that we've understood what `flat` and `map` mean separately, understanding `flat_map` is a piece of cake.

To compute a `flat_map`, first `map` the collection, and then `flatten` it. It's that simple.

## Why have a `flat_map` function?

The concept of `flat_map` gets used very often when attempting to explain the mystical concept of [monads](https://en.wikipedia.org/wiki/Monad_(functional_programming)). Monads themselves are a very interesting concept and are very heavily used by the functional programming community to handle ["impurity"](https://stackoverflow.com/questions/14255775/monadic-impurity-and-haskells-purity-how-they-are-combined). If you've ever fiddled with lists, streams, or optional values, you've interacted with monads (yay 🎉).

Monads are known for being notoriously difficult to explain so much so that there exists the curse of the monads:

> “Once you understand monads, you immediately become incapable of explaining them to anyone else” Lady Monadgreen’s curse ~ Gilad Bracha
 
Not that this curse is shying me away from attempting to explain it, but understanding monads is fortunately not necessary to implement `flat_map`. There are a ton of resources available to embark on the journey of understanding monads, so I'll save the task of venturing on that journey to the reader.

With these conceptuals out of the way, let's get to implementing `flat_map` in Rust.

## Getting started

Let's create a new `lib` called `flat_map`

```bash
cargo new --lib flat_map
```

This should generate the following file structure

```bash
flat_map/
├── Cargo.toml
└── src
    └── lib.rs
```

Before we start coding the function, let's write some tests.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty() {
        assert_eq!(flat_map(std::iter::empty(), |x: Vec<()>| {x}).count(), 0);
    }

    #[test]
    fn simple() {
        assert_eq!(flat_map(vec!["a", "b"].into_iter(), |x| {x.chars()}).count(), 2);
    }

    #[test]
    fn simple_wide() {
        assert_eq!(flat_map(vec!["al", "bet"].into_iter(), |x| x.chars()).count(), 5);
    }

    #[test]
    fn from_std_lib_test() {
        let words = ["alpha", "beta", "gamma"];
        
        // chars() returns an iterator
        let merged: String = flat_map(words.iter(), |s| s.chars())
                                  .collect();
        assert_eq!(merged, "alphabetagamma");
    }

    #[test]
    fn empty_middle() {
        let words = ["alpha", "", "beta", "", "", "gamma"];
        let merged: String = flat_map(words.iter(), |s| s.chars()).collect();
        assert_eq!(merged, "alphabetagamma");
    }
}
```

A couple of things to note:
* The api for the `flat_map` implementation is implicit from the tests. It takes in an iterator and a closure, and returns something that can be turned into an iterator. The specific types of these parameters will be discussed later 
* I'm using the `#[cfg(test)]` annotation. This ensures that tests don't get compiled along with non-test code when running `cargo build`.

The first three tests are pretty basic. Each one executes `flat_map` and checks if it returns the current number of elements.

The last two tests are the most interesting ones. The first one is straight from the standard library documentation, but adapted to our api. The expected behavior of running `flat_map` using the specified closure is that it should run `chars()` on each input element, resulting in a list of iterators over the characters in each`str`. Then it should flatten each iterator in the list resulting in an iterator yielding `char`s. Using `collect()` and type coercion, this iterator is collected into a `String` and asserted with the expected output. The second one augments it by add empty strings in between. The function should continue to iterate over the rest of the list of `chars`, even if it encounters an empty string. 

## A first pass

To begin with, let's write down the function definition for `flat_map`.

```rust
pub fn flat_map<I, F, B>(iter: I, f: F) -> FlatMap<I, F, B>
where
    I: Iterator,
    F: FnMut(I::Item) -> B,
    B: IntoIterator
{
    FlatMap::new(iter, f)
}
```

There's a lot going on in this function. Let's break it down a bit.

Here we're defining a function called `flat_map`. It takes in two parameters `iter` and `f`, and returns something that is of types `FlatMap`. We haven't defined the `FlatMap` type just yet, but we'll get to it soon. The function body is fairly simple. We simply invoke the `new` associated method on `FlatMap` and return it.

Cool, but what on earth are those generics? It'll make a lot of sense if we take a look at the trait bounds. Here we are saying that the type of the generic parameter `I` is bounded by the trait `Iterator`. This means that the type `I` must implement the `Iterator` trait. Ergo, the parameter `iter` must implemented `Iterator`. This trait bound makes sense: we must only be able to call `flat_map` on an iterator. It doesn't make sense to call `flat_map` on non-iterable values.

Let's take a look at the second generic parameter, `F`. This one is very interesting, at least syntax wise. `F` is bounded by the trait `FnMut(I::Item) -> B`. What does that mean? At a high level, you can think of `F` as the type of a closure that takes in `I::Item` and returns something of type `B`. Since `I` is an iterator, it has an associated type `Item`. Therefore, the parameter `f` is a closure that takes in an element of the same type that `iter` yields, and returns something of type `B`. This is the closure that will handle the `map` part of `flat_map`.

The observant reader will note that the syntax for specifying the `FnMut` trait bound is different. It almost looks like a function definition itself. As with most beautiful things in Rust, this is sugar syntax for the real *unstable* `Fn` trait. This syntax is needed to make using **Higher-Rank Trait Bounds** ergonomic in Rust. They don't really show up in too many contexts outside of the `Fn` family of traits. You can read more about the technical details in the [nomicon](https://doc.rust-lang.org/nightly/nomicon/hrtb.html).

Finally, let's tackle the generic parameter `B`. We are saying that it must be bounded by the trait bound `IntoIterator`. Hmmm, but why? Let's zoom out a little bit and review what `flat_map` does. `flat_map` first maps the collection, and then flattens it. As we've seen before, the closure `f` does the map part. Now, to flatten it, we need a collection of nested collections, i.e, each element of the mapped collection must itself another collection. In other words, each element of the mapped collection can be iterated over, which basically means that it can be turned **into** an **iterator**. Hence, the trait bound `IntoIterator`.

Phew, that function did have a lot going on. Let's move on to writing out the `FlatMap` struct. That's where all of the action happens.

```rust
pub struct Flatmap<I, F, B> 
where
    I: Iterator,
    f: FnMut(I::Item) -> B,
    B: IntoInterator
{
    iter: I,
    f: F,
    inner: Option<B::IntoIter>
}

impl<I, F, B> for FlatMap<I, F, B> 
where
    I: Iterator,
    f: FnMut(I::Item) -> B,
    B: IntoInterator
{
    fn new(iter: I, f: f) -> Self {
        iter,
        f,
        inner: None,
    }
}
```

This one should be fairly straightforward. We define a struct `FlatMap` with the same trait bounds as the function `flat_map`. `iter` stores the thing we are iterating over, `f` stores the closure that gets invoked on every element. But what is `inner` doing? 

Iterators in Rust are lazy. Funnily enough, in the context of iterators, lazyiness is actually a great thing. It means that the iterator invokes `next()` only when it needs to. Calling `iter` or `map` or any method that returns an iterator doesn't actually iterate over the collection. You have to write some code that will actually consume the iterator.

```rust
let a = vec![1, 2, 3];
a.iter().map(|x| x + 1);
```

This code looks like it performs the map. However, it doesn't. The compiler will give you a warning saying 

```bash
   Compiling playground v0.0.1 (/playground)
warning: unused `std::iter::Map` that must be used
 --> src/main.rs:3:1
  |
3 | a.iter().map(|x| x + 1);
  | ^^^^^^^^^^^^^^^^^^^^^^^^
  |
  = note: `#[warn(unused_must_use)]` on by default
  = note: iterators are lazy and do nothing unless consumed

warning: 1 warning emitted

    Finished dev [unoptimized + debuginfo] target(s) in 0.58s
     Running `target/debug/playground`
```

As the message says, iterators are lazy. They need to be consumed. One way to consume it is by simply calling `collect` on the iterator.

```rust
let a = vec![1, 2, 3];
let b: Vec<usize> = a.iter().map(|x| x + 1).collect();
```

The type of the collection to be returned was inferred from the type of `b`.

To implement `Iterator` for a struct, at a minimum, we need to implement the `next` method specified by the trait. Any consumer of an iterator will have to invoke `next` to actually advance through it.

Remember I said that `flat_map` first maps the collection, and then flattens it. This gives the illusion that we must first iterate over the entire collection, map each element, and then flatten the resulting collection. A very naive implementation of this idea would mean that the first call to `next` will iterate over the entire collection, but subsequent calls would just spit out the processed values. That's definitely not lazy in nature, and it's not efficient. We can do better!

Let's try to figure out what should happen on the first call to `next()` for the `FlatMap` iterator. We first need to map, and then flatten. Invoking `f` on the first element of `iter` will do the mapping. This will return an iterator. Invoking `next` on this iterator will begin the process of flattening it. It will return the first element of the `flat_map`ed collection. Lazy? check. Will doing this for every call to `next` work? Let's find out!

```rust
impl<I, F, B> Iterator for FlatMap<I, F, B> 
where
    I: Iterator,
    F: FnMut(I::Item) -> B,
    B: IntoIterator
{
    type Item = B::Item; 
    fn next(&mut self) -> Option<Self::Item> {
        let mut iterator = Some((self.f)(self.iter.next()?).into_iter());
        iterator.as_mut()?.next()
    }
}
```

One iteresting thing here is the assignment for `Item`. `B` implements `IntoIterator`. The value of the associated type `B::Item` is the type that an iterator over `B` will return. That's exactly the type that we want `flat_map` to return.

Let's see if it compiles.

```bash
> cargo build

   Compiling flat_map v0.1.0 (/Users/eltonpinto/dev/learn/rust_iterators/flat_map)
warning: field is never read: `inner`
  --> src/lib.rs:25:5
   |
25 |     inner: Option<B::IntoIter>,
   |     ^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = note: `#[warn(dead_code)]` on by default

    Finished dev [unoptimized + debuginfo] target(s) in 0.09s

```

We can safely ignore the warning. Woo hoo! It compiles. That means it should work right? Let's run our tests.


```bash
> cargo test

  Compiling flat_map v0.1.0 (/Users/eltonpinto/dev/learn/rust_iterators/flat_map)
    Finished test [unoptimized + debuginfo] target(s) in 0.55s
     Running target/debug/deps/flat_map-1bcf67ed8ede3985
  
running 4 tests
test tests::empty ... ok
test tests::simple ... ok
test tests::from_std_lib_test ... FAILED
test tests::simple_wide ... FAILED

failures:

---- tests::from_std_lib_test stdout ----
thread 'tests::from_std_lib_test' panicked at 'assertion failed: `(left == right)`
  left: `"abg"`,
 right: `"alphabetagamma"`', src/lib.rs:104:9
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

---- tests::simple_wide stdout ----
thread 'tests::simple_wide' panicked at 'assertion failed: `(left == right)`
  left: `2`,
 right: `5`', src/lib.rs:93:9


failures:
    tests::from_std_lib_test
    tests::simple_wide

test result: FAILED. 2 passed; 2 failed; 0 ignored; 0 measured; 0 filtered out

error: test failed, to rerun pass '--lib'

```
Hmm, that didn't work.

Taking a closer look at the results, it seems like our implementation is collecting only the first element of each nested collection. The reason is that every call to `next` for `FlatMap` invokes `map` on the next element of `iter`. We invoke `f`, get the new iterator, and then call `next` on this iterator only once. This new iterator gets dropped as it goes out of scope. We are basically ignoring the rest of the values in the iterator, and return only the first one.


## Fixing the error

To solve this problem, we need some way of persisting that **inner** iterator returned by `f` so that subsequent calls to `next` on `FlatMap` will first consume the inner iterator, and only then advance to the next element in `iter`. Hmmm, how do we do that? Well, we'll use the `inner` field of `FlatMap`!

Whenever we call `next` on `iter`, we will persist the iterator we get in `inner`. Then, on subsequent calls to `next` on `FlatMap`, we will first consume `inner`. Once `inner` is consumed, we will call `next` on `iter` and repeat the process.

There is one issue that we still need to fix. What should we do if the inner iterator itself has nothing to iterate over, i.e., it returns `None` on the first call to `next()`? The expected behavior is to continue to iterate over the outer list until you find an inner iterator that returns something. To handle this case, we can simple wrap our logic in a `loop` and return as soon as the inner iterator returns something, or we've completely iterated over the outer iterator.

Let's code this out!

```rust
impl<I, F, B> Iterator for FlatMap<I, F, B> 
where
    I: Iterator,
    F: FnMut(I::Item) -> B,
    B: IntoIterator
{
    type Item = B::Item; 
    fn next(&mut self) -> Option<Self::Item> {
        loop {
            if let Some(ref mut inner) = self.inner {
                if let Some(val) = inner.next() {
                    return Some(val);
                }
            self.inner = Some((self.f)(self.iter.next()?).into_iter());
        }
    }
}
```

Awesome, now let's run the tests...

```bash
> cargo test

running 5 tests
test tests::empty ... ok
test tests::empty_middle ... ok
test tests::simple ... ok
test tests::from_std_lib_test ... ok
test tests::simple_wide ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out

   Doc-tests flatmap

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

Yes!!! All tests passed. We've successfully implemented `flat_map`!

## Learnings

While implementing `flat_map`, I was surprisingly able to better understand Higher-Ranked Trait Bounds. When I read about it in the nomicon before, it didn't make any sense and I merely brushed over it. It was when I tried writing out the trait bound for `FnMut` myself did i realize it's significance. I also developed a more stronger love for the `?` operator. Boy does it make code look a lot more cleaner.

## Final code

Here's the final code:

```rust
fn flat_map<I, F, B>(iter: I, f: F) -> FlatMap<I, F, B>
where
    I: Iterator,
    F: FnMut(I::Item) -> B, 
    B: IntoIterator
{
    FlatMap::new(iter, f)
}

struct FlatMap<I, F, B> 
where
    I: Iterator,
    F: FnMut(I::Item) -> B,
    B: IntoIterator
{
    iter: I,
    f: F,
    inner: Option<B::IntoIter>
}

impl<I, F, B> FlatMap<I, F, B> 
where
    I: Iterator,
    F: FnMut(I::Item) -> B,
    B: IntoIterator
{
    pub fn new(iter: I, f: F) -> Self {
        Self { iter, f, inner: None}
    }
}

impl<I, F, B> Iterator for FlatMap<I, F, B> 
where
    I: Iterator,
    F: FnMut(I::Item) -> B,
    B: IntoIterator
{
    type Item = B::Item; 
    fn next(&mut self) -> Option<Self::Item> {
        if let Some(ref mut inner) = self.inner {
            if let Some(val) = inner.next() {
                return Some(val);
            }
        }
        self.inner = Some((self.f)(self.iter.next()?).into_iter());
        self.inner.as_mut()?.next()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty() {
        assert_eq!(flat_map(std::iter::empty(), |x: Vec<()>| {x}).count(), 0);
    }

    #[test]
    fn simple() {
        assert_eq!(flat_map(vec!["a", "b"].into_iter(), |x| {x.chars()}).count(), 2);
    }

    #[test]
    fn simple_wide() {
        assert_eq!(flat_map(vec!["al", "bet"].into_iter(), |x| {x.chars()}).count(), 5);
    }

    #[test]
    fn from_std_lib_test() {
        let words = ["alpha", "beta", "gamma"];
        
        // chars() returns an iterator
        let merged: String = flat_map(words.iter(), |s| s.chars())
                                  .collect();
        assert_eq!(merged, "alphabetagamma");
    }
}
```

P.S: My initial implementation did not handle the `empty_middle` test case. Huge thanks to Domantas, Rodrigo, and Paul for spotting the bug!
