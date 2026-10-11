# runall baseline

- date: 2026-10-11T19:40:37.694Z
- commit: 28b921d
- node: v24.17.0
- cpu: AMD Ryzen 5 5500U with Radeon Graphics         

## Code stats

| file | lines | names <=2 chars | lines >100 chars | functions >80 lines |
|---|---|---|---|---|
| aidriver.js | 832 | 319 | 369 | 5 |
| audio.js | 328 | 12 | 6 | 3 |
| autodrive.js | 65 | 25 | 20 | 0 |
| cars.js | 468 | 22 | 126 | 0 |
| carstats.js | 217 | 0 | 0 | 0 |
| cones.js | 493 | 150 | 94 | 3 |
| contact.js | 79 | 46 | 12 | 0 |
| damage.js | 108 | 31 | 41 | 0 |
| guide.js | 316 | 82 | 60 | 2 |
| highway.js | 621 | 391 | 265 | 1 |
| hud.js | 607 | 187 | 176 | 3 |
| hwrace.js | 109 | 43 | 51 | 0 |
| input.js | 224 | 29 | 24 | 1 |
| lab.js | 3628 | 1291 | 1119 | 0 |
| main.js | 1007 | 254 | 286 | 1 |
| marks.js | 173 | 28 | 37 | 1 |
| menu.js | 519 | 230 | 204 | 1 |
| raceflow.js | 102 | 30 | 34 | 0 |
| render.js | 3893 | 1238 | 916 | 7 |
| roll.js | 111 | 20 | 36 | 0 |
| stagegen.js | 225 | 156 | 107 | 1 |
| testlist.js | 24 | 0 | 17 | 0 |
| traffic.js | 233 | 119 | 94 | 2 |
| tune.js | 124 | 67 | 7 | 0 |
| vehicle.js | 1080 | 78 | 326 | 2 |
| TOTAL | 15586 | 4848 | 4427 | 33 |

## Steps

| name | exit | s |
|---|---|---|
| aifieldsuite | 0 | 70.6 |
| pacesuite | 0 | 20.9 |
| weavecheck | 0 | 3.2 |
| barriercheck | 0 | 0.6 |
| solidcheck | 0 | 16.5 |
| propcheck | 0 | 0.8 |
| uicheck | 0 | 18.1 |
| menucheck | 0 | 36.8 |
| lapdriver hatch-fwd | 0 | 1.1 |
| lapdriver hatch-rwd | 0 | 1.1 |
| lapdriver saloon-rwd | 0 | 1.1 |
| lapdriver wrz-awd | 0 | 1.1 |
| lapdriver estate-4x4 | 0 | 1.1 |
| lapdriver muscle-rwd | 0 | 1.1 |
| lapdriver rally-4x4 | 0 | 1.1 |
| lapdriver track-rwd | 0 | 1.1 |
| lapdriver naffcar | 0 | 1.1 |
| lapdriver tractor | 0 | 1.1 |
| lapdriver mini-fwd | 0 | 1.1 |
| lapdriver lambo-awd | 0 | 1.1 |
| lapdriver mikra-r1 | 0 | 1.1 |
| lapdriver kit-2l | 0 | 1.1 |
| lapdriver rx-super | 0 | 1.1 |
| lapdriver banger-f2 | 0 | 1.1 |
| lapdriver grass-special | 0 | 1.1 |
| lapdriver drift-s13 | 0 | 1.1 |
| lapdriver f2-rwd | 0 | 1.0 |
| framecheck test-track | 0 | 22.1 |
| framecheck thruston | 0 | 22.9 |
| framecheck stock-car | 0 | 22.2 |
| profile test-track | 0 | 21.9 |
| profile thruston | 0 | 22.1 |
| profile stock-car | 0 | 21.8 |

### aifieldsuite

```
naffcar hatch-rwd diff 2 x6 seed 5: 111 s | contact 13.9 s in 66 events ({"start":3,"noseTail":4,"side":59}) | order changes 7 | PASSES 7 | INCIDENTS 3 {"off":2,"spin":0,"hit":1,"reset":0} | FOLLOW 1 s
naffcar hatch-rwd diff 2 x6 seed 19: 104 s | contact 16.6 s in 156 events ({"start":30,"noseTail":93,"side":33}) | order changes 11 | PASSES 5 | INCIDENTS 4 {"off":1,"spin":1,"hit":2,"reset":0} | FOLLOW 4 s
naffcar hatch-rwd diff 2 x6 seed 23: 104 s | contact 15.9 s in 119 events ({"start":35,"noseTail":0,"side":84}) | order changes 11 | PASSES 12 | INCIDENTS 2 {"off":1,"spin":0,"hit":0,"reset":1} | FOLLOW 0 s
INCIDENTS diff 2: 97 in 24 races = 4.0 per race ({"off":34,"spin":32,"hit":25,"reset":6})
TOTAL diff 2: passes 178 | contact 264.9 s / 2849 events | resets 6 | off-road 627 car-s | following 92 car-s | kinds {"start":426,"noseTail":1123,"side":1300}
```

### pacesuite

```
    seed   77 d4: mean 157 km/h | <130 19% | passes 2.3/km | contacts rr 134 rt 0 | off 0 far 0 | wrecked none
    seed 1234 d0: mean 127 km/h | <130 59% | passes 4.2/km | contacts rr 0 rt 0 | off 0 far 0 | wrecked none
    seed 1234 d2: mean 135 km/h | <130 40% | passes 2.7/km | contacts rr 1 rt 0 | off 0 far 0 | wrecked none
    seed 1234 d4: mean 148 km/h | <130 28% | passes 4.3/km | contacts rr 0 rt 0 | off 325 far 0 | wrecked none
TOTAL baseline: mean 129.1 km/h | <130 38% | passes 4.1/km | rr 992 rt 281 | off 5997 far 5344 | BAD (far off >= 120 or wreck) runs 3/9
```

### weavecheck

```
BAD  seed 1234 240 km/h wall   : hit-steps 0, rear slip 0.32, wide 9.0 m, slowest 0 km/h, 14.0 s
BAD  seed 1234 240 km/h wallR  : hit-steps 0, rear slip 0.42, wide 5.0 m, slowest 0 km/h, 14.0 s
BAD  seed 1234 240 km/h slalom : hit-steps 0, rear slip 0.32, wide 9.8 m, slowest 0 km/h, 14.0 s
BAD  seed 1234 240 km/h pairs  : hit-steps 0, rear slip 0.40, wide 9.3 m, slowest 0 km/h, 14.0 s
diff 2: 45 scenarios | hit in 0 | spun (slip > 0.25) in 5 | > 1 m wide in 5
```

### barriercheck

```
OK   armco    101 pts, nearest 16.0 m from the centreline (road edge 7), on a lane: 0
OK   armco    43 pts, nearest 16.0 m from the centreline (road edge 7), on a lane: 0
OK   armco    17 pts, nearest 16.0 m from the centreline (road edge 7), on a lane: 0
OK   fence    48 pts, nearest 22.0 m from the centreline (road edge 7), on a lane: 0
barriers: all OK
```

### solidcheck

```
OK   truck    head worst overlap -0.02 m, at the end -0.89 m, speed after 0.0 m/s (hit at 15)
OK   hangar   head worst overlap -0.04 m, at the end -2.09 m, speed after 0.0 m/s (hit at 15)
OK   marshal  head worst overlap -0.02 m, at the end -0.90 m, speed after 0.0 m/s (hit at 15)
OK   board    head worst overlap 0.03 m, at the end -1.12 m, speed after 3.0 m/s (hit at 15)
solids: all OK
```

### propcheck

```
OK   grass-track          
OK   stock-car            
OK   naffcar              
OK   sandbox              
props: all clear of the road
```

### uicheck

```
landscape 844x390    start=hatch-rwd expanded=true after=estate-4x4 steer=0 resetX=-28.3
portrait 390x844     start=hatch-rwd expanded=true after=estate-4x4 steer=0 resetX=-28.3
HUD reachable on touch: OK
no control overlaps at 6 sizes, tyre HUD off and on: OK
```

### menucheck

```
844x390 demo {"mode":"menu","v":"21.9","car":"hatch-rwd"} | session {"mode":"session","level":"naffcar","car":"wrz-awd"} | pause true sim frozen true | errors none
390x844 demo {"mode":"menu","v":"23.0","car":"hatch-rwd"} | session {"mode":"session","level":"naffcar","car":"wrz-awd"} | pause true sim frozen true | errors none
```

### lapdriver hatch-fwd

```
test-track / hatch-fwd: LAP 54.0 s | top 108 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 17.9, dirt 14.2, racetarmac 10.4, broken 9.0, ice 1.6, puddle 0.8
  OK — a drivable lap
```

### lapdriver hatch-rwd

```
test-track / hatch-rwd: LAP 53.7 s | top 112 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 18.0, dirt 14.2, racetarmac 9.9, broken 9.0, ice 1.7, puddle 0.9
  OK — a drivable lap
```

### lapdriver saloon-rwd

```
test-track / saloon-rwd: LAP 53.2 s | top 115 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 17.7, dirt 14.1, racetarmac 9.9, broken 8.9, ice 1.6, puddle 0.9
  OK — a drivable lap
```

### lapdriver wrz-awd

```
test-track / wrz-awd: LAP 50.3 s | top 120 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 17.1, dirt 13.6, racetarmac 8.7, broken 8.7, ice 1.5, puddle 0.8
  OK — a drivable lap
```

### lapdriver estate-4x4

```
test-track / estate-4x4: LAP 53.2 s | top 109 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 17.9, dirt 14.2, racetarmac 9.6, broken 9.0, ice 1.7, puddle 0.8
  OK — a drivable lap
```

### lapdriver muscle-rwd

```
test-track / muscle-rwd: LAP 52.0 s | top 116 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 17.6, dirt 13.8, racetarmac 9.4, broken 8.8, ice 1.7, puddle 0.7
  OK — a drivable lap
```

### lapdriver rally-4x4

```
test-track / rally-4x4: LAP 49.7 s | top 121 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 16.8, dirt 13.5, racetarmac 8.7, broken 8.5, ice 1.5, puddle 0.8
  OK — a drivable lap
```

### lapdriver track-rwd

```
test-track / track-rwd: LAP 46.6 s | top 129 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 15.5, dirt 12.7, racetarmac 8.3, broken 7.9, ice 1.5, puddle 0.7
  OK — a drivable lap
```

### lapdriver naffcar

```
test-track / naffcar: LAP 48.0 s | top 126 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 16.1, dirt 12.9, racetarmac 8.6, broken 8.1, ice 1.5, puddle 0.7
  OK — a drivable lap
```

### lapdriver tractor

```
test-track / tractor: LAP 56.6 s | top 68 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 19.3, dirt 13.7, racetarmac 12.2, broken 9.1, ice 1.7, puddle 0.7
  OK — a drivable lap
```

### lapdriver mini-fwd

```
test-track / mini-fwd: LAP 54.7 s | top 101 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 18.1, dirt 14.3, racetarmac 10.5, broken 9.2, ice 1.5, puddle 1.1
  OK — a drivable lap
```

### lapdriver lambo-awd

```
test-track / lambo-awd: LAP 48.4 s | top 125 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 16.3, dirt 13.2, racetarmac 8.3, broken 8.3, ice 1.5, puddle 0.7
  OK — a drivable lap
```

### lapdriver mikra-r1

```
test-track / mikra-r1: LAP 54.0 s | top 106 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 17.9, dirt 14.3, racetarmac 10.2, broken 9.1, ice 1.7, puddle 0.9
  OK — a drivable lap
```

### lapdriver kit-2l

```
test-track / kit-2l: LAP 51.7 s | top 113 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 17.1, dirt 13.9, racetarmac 9.6, broken 8.7, ice 1.6, puddle 0.8
  OK — a drivable lap
```

### lapdriver rx-super

```
test-track / rx-super: LAP 48.6 s | top 124 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 16.5, dirt 13.3, broken 8.4, racetarmac 8.3, ice 1.5, puddle 0.8
  OK — a drivable lap
```

### lapdriver banger-f2

```
test-track / banger-f2: LAP 52.9 s | top 112 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 17.7, dirt 14.1, racetarmac 9.7, broken 8.9, ice 1.7, puddle 0.9
  OK — a drivable lap
```

### lapdriver grass-special

```
test-track / grass-special: LAP 52.0 s | top 113 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 17.5, dirt 13.9, racetarmac 9.3, broken 8.8, ice 1.7, puddle 0.8
  OK — a drivable lap
```

### lapdriver drift-s13

```
test-track / drift-s13: LAP 52.7 s | top 114 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 17.7, dirt 14.0, racetarmac 9.6, broken 8.9, ice 1.7, puddle 0.8
  OK — a drivable lap
```

### lapdriver f2-rwd

```
test-track / f2-rwd: LAP 47.7 s | top 126 km/h | off the road 0.0 s, worst 0.0 m beyond the edge
  seconds per surface: tarmac 15.9, dirt 12.9, racetarmac 8.5, broken 8.1, ice 1.5, puddle 0.7
  OK — a drivable lap
```

### framecheck test-track

```
test-track (CPU x4, autodrive lap): frame ms median 16.7 | p95 17.0 | worst 49.9 | frames over 33 ms: 15 of 570 | tiles painted 149, 11.3 ms each
```

### framecheck thruston

```
thruston (CPU x4, autodrive lap): frame ms median 16.7 | p95 33.3 | worst 66.5 | frames over 33 ms: 45 of 570 | tiles painted 151, 12.8 ms each
```

### framecheck stock-car

```
stock-car (CPU x4, autodrive lap): frame ms median 16.7 | p95 17.1 | worst 50.0 | frames over 33 ms: 18 of 570 | tiles painted 128, 11.6 ms each
```

### profile test-track

```
  0.6%  (garbage collector) :-1
  0.6%  stroke :-1
  0.6%  frame render.js:3751
  0.6%  setTransform :-1
  0.6%  (anon) hud.js:56
```

### profile thruston

```
  0.7%  frame render.js:3751
  0.7%  stroke :-1
  0.7%  drawCurvedKerbs render.js:462
  0.6%  naturalHeightAt lab.js:554
  0.6%  (garbage collector) :-1
```

### profile stock-car

```
  0.7%  drive autodrive.js:21
  0.7%  fill :-1
  0.6%  requestAnimationFrame :-1
  0.6%  (anon) hud.js:56
  0.6%  restore :-1
```
