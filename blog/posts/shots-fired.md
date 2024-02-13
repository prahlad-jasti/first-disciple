---
title: Shots fired
description: Shooting myself in the foot, OCaml edition.
date: 2023-02-18
excerpt: Shooting myself in the foot, OCaml edition.
---

# Shots fired

The following is a collection of rather stupid ways I've shot myself in the foot in OCaml. I intend to update this page should my wonderful feet get shot again :)

## No `ifs` given

```ocaml
open Format

let () =
  let say_this = false in
  if say_this then
    printf "ignore what's said next :)\n";
    printf "<insert something that can get you cancelled>\n";
    printf "but hey, no ifs given\n" ;
```

will (sadly) print

```bash
<insert something that can get you cancelled>
but hey, no ifs given
```

## Unmatched

```ocaml
type child =
| C0
| C1

type parent =
| P0
| P1 of child
| P2 of child * child

let foo p =
  match p with
  | P0 -> "p0"
  | P1 c ->
    match c with
    | C0 -> "p1->c0"
    | C1 -> "p1->c1"
  | P2 _ -> "p2" 
```

will fail to compile with an error message...

```bash
File "main.ml", line 17, characters 4-6:
17 |   | P2 _ -> "p2"
         ^^
Error: This variant pattern is expected to have type child
       There is no constructor P2 within type child
```

The fix: wrap the nested `match` with either `(..)` or `begin..end`.

```ocaml
...
  | P1 c ->
    (match c with
    | C0 -> "p1->c0"
    | C1 -> "p1->c1")
...
```

## The rebound

You start by writing this neat function...

```ocaml
let rec foo flags xs =
  match xs with
  | [] -> []
  | x :: xs ->
    let flags = new_flags x in
    let x = a_long_function_name x in
    x :: (foo flags xs)
```

But then, the compulsion to make your code look ✨beautiful✨ (or realistically, you did not bother perusing the logic of the program) leads you to refactor it as follows:

```ocaml
let rec foo flags xs =
  match xs with
  | [] -> []
  | x :: xs ->
    let x = a_long_function_name x in
    let flags = new_flags x in
    x :: (foo flags xs)
```

and all the tests fail... oops :)

## To `;` or not

```ocaml
let () =
  let xs = [1,2,3,4,5] in
  Format.printf "%d" (List.length xs)
```

will print `1` (and not `5`). List elements are delimited by `;` and not `,`.
