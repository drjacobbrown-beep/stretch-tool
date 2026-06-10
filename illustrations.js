/* ============================================================
   Exercise illustration engine  v2  — "movement-readable"
   ------------------------------------------------------------
   Goal: you should understand the MOVEMENT from the picture.
   Each exercise is drawn as an articulated side-view figure in
   TWO positions:
       • START  — faded "ghost" figure (where you begin)
       • END    — solid figure (where you finish)
   plus a MOTION ARROW showing how the body part travels, and a
   small colored marker on the target region.

   Pure SVG, no network, no images. Prints cleanly in B&W
   (figures are dark slate; the start ghost is light gray; the
   arrow is a solid shape that reads without color).

   API (unchanged):
       window.exerciseSVG(exercise, size) -> SVG string
       window.exercisePose(exercise)      -> base-position key
   ============================================================ */
(function(){
  const INK   = "#334155";   // solid (end) figure
  const INK_H = "#475569";   // solid head/hand/foot fill
  const GHOST = "#aeb7c2";   // start (ghost) figure
  const MAT   = "#cbd5e1";
  const MAT_FILL = "#e8edf3";
  const TYPE_COLOR = { stretch:"#0f766e", strengthening:"#b45309", mobility:"#6d28d9" };
  const ARROW = "#1f2937";   // motion arrow (dark, B&W-safe)

  /* ============ low-level geometry ============ */
  function lerp(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; }

  // tapered limb: a 2-segment polyline shoulder->elbow->hand with round joints
  function limb(p,a,b,c){ return `<path d="M${p[a][0]} ${p[a][1]} L${p[b][0]} ${p[b][1]} L${p[c][0]} ${p[c][1]}"/>`; }
  function spine(p){ return `<path d="M${p.nk[0]} ${p.nk[1]} Q${p.sh[0]} ${p.sh[1]} ${p.hp[0]} ${p.hp[1]}"/>`; }
  function bone(p1,p2){ return `<path d="M${p1[0]} ${p1[1]} L${p2[0]} ${p2[1]}"/>`; }

  // Clean line-figure: medium rounded strokes, slightly thicker torso, plain solid
  // head, small hand/foot dots. The far-side arm/leg draws in a LIGHTER tone first,
  // so overlapping limbs stay readable instead of merging into a blob.
  function figure(J, color, opacity, headFill, faceDir){
    const LW=4.6, TW=6.8;
    const far = (color===INK) ? "#94a0b1" : color;
    let s='';
    if(J.el2 || J.kn2){
      s += `<g fill="none" stroke="${far}" stroke-width="${LW}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}">`;
      if(J.el2) s += limb(J,'sh','el2','ha2');
      if(J.kn2) s += limb(J,'hp','kn2','ft2');
      s += `</g><g fill="${far}" stroke="none" opacity="${opacity}">`;
      if(J.ha2) s += `<circle cx="${J.ha2[0]}" cy="${J.ha2[1]}" r="2.4"/>`;
      if(J.ft2) s += `<circle cx="${J.ft2[0]}" cy="${J.ft2[1]}" r="2.7"/>`;
      s += `</g>`;
    }
    s += `<g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}">`;
    s += `<g stroke-width="${TW}">`+spine(J)+`</g>`;
    s += `<g stroke-width="${LW}">`;
    s += `<path d="M${J.nk[0]} ${J.nk[1]} L${J.hd[0]} ${J.hd[1]}"/>`;
    s += limb(J,'sh','el','ha');
    s += limb(J,'hp','kn','ft');
    s += `</g></g>`;
    s += `<g fill="${headFill}" stroke="none" opacity="${opacity}">`;
    s += `<circle cx="${J.hd[0]}" cy="${J.hd[1]}" r="7"/>`;
    s += `<circle cx="${J.ha[0]}" cy="${J.ha[1]}" r="2.6"/>`;
    s += `<circle cx="${J.ft[0]}" cy="${J.ft[1]}" r="2.9"/>`;
    s += `</g>`;
    return s;
  }

  // Front-view upper-body bust (for cervical / scapular head moves).
  // Uses hd (head center), nk (neck base), sh (shoulder center).
  // Draws a head, a tilting neck, a wide horizontal shoulder bar and a short torso.
  // Optional arm: if J.armX present, draws a bent arm hand-to-head (isometric press).
  // Front-view bust for neck/scapular moves: shoulders + neck + a large head with
  // two small eyes so it clearly reads as a person facing you. Clean medium lines.
  function bustFigure(J, color, opacity, headFill, faceDir){
    const shY = J.sh[1], cx = J.sh[0], half = 18, TW = 7.5, AW = 4.6;
    let s = `<g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}">`;
    s += `<g stroke-width="${TW}">`;
    s += `<path d="M${cx-half} ${shY} L${cx+half} ${shY}"/>`;          // shoulders
    s += `<path d="M${cx} ${shY} L${cx} ${shY+17}"/>`;                 // torso
    s += `<path d="M${cx} ${shY} L${J.nk[0]} ${J.nk[1]} L${J.hd[0]} ${J.hd[1]}"/>`; // neck->head
    s += `</g>`;
    s += `<g stroke-width="${AW}">`;
    if(J.el && J.ha){ s += `<path d="M${cx-half} ${shY} L${J.el[0]} ${J.el[1]} L${J.ha[0]} ${J.ha[1]}"/>`; }
    if(J.el2 && J.ha2){ s += `<path d="M${cx+half} ${shY} L${J.el2[0]} ${J.el2[1]} L${J.ha2[0]} ${J.ha2[1]}"/>`; }
    s += `</g></g>`;
    s += `<circle cx="${J.hd[0]}" cy="${J.hd[1]}" r="8.6" fill="${headFill}" stroke="none" opacity="${opacity}"/>`;
    s += `<g fill="#ffffff" stroke="none" opacity="${opacity}"><circle cx="${(J.hd[0]-3).toFixed(1)}" cy="${(J.hd[1]-1).toFixed(1)}" r="1.3"/><circle cx="${(J.hd[0]+3).toFixed(1)}" cy="${(J.hd[1]-1).toFixed(1)}" r="1.3"/></g>`;
    return s;
  }

  /* ============ arrows ============ */
  function head_(x,y,ang,c,sz){ sz=sz||5; const a=ang, w=0.42;
    const p1=[x,y], p2=[x-sz*Math.cos(a-w), y-sz*Math.sin(a-w)], p3=[x-sz*Math.cos(a+w), y-sz*Math.sin(a+w)];
    return `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${p2[0].toFixed(1)} ${p2[1].toFixed(1)} L${p3[0].toFixed(1)} ${p3[1].toFixed(1)} Z" fill="${c}" stroke="none"/>`;
  }
  // straight-ish arrow from A to B with optional perpendicular bow
  function arrow(A,B,bow,c){ c=c||ARROW; bow=bow||0;
    const mx=(A[0]+B[0])/2, my=(A[1]+B[1])/2, dx=B[0]-A[0], dy=B[1]-A[1];
    const len=Math.hypot(dx,dy)||1, nx=-dy/len, ny=dx/len;
    const cx=mx+nx*bow, cy=my+ny*bow;
    const ang=Math.atan2(B[1]-cy, B[0]-cx);
    return `<path d="M${A[0]} ${A[1]} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${B[0]} ${B[1]}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`
         + head_(B[0],B[1],ang,c);
  }
  // curved rotation arc centered at (cx,cy)
  function arc(cx,cy,r,a0,a1,c){ c=c||ARROW;
    const x0=cx+r*Math.cos(a0), y0=cy+r*Math.sin(a0), x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1);
    const large = Math.abs(a1-a0)>Math.PI?1:0, sweep = a1>a0?1:0;
    const tang = a1 + (sweep?1:-1)*Math.PI/2;
    return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`
         + head_(x1,y1,tang,c);
  }

  /* ============ base skeletons (side view, facing right) ============ */
  // clone helper
  function B(o){ const r={}; for(const k in o) r[k]=o[k].slice(); return r; }
  const BASE = {
    stand:{ env:'floor', envY:90, J:{hd:[46,15],nk:[46,22],sh:[47,30],hp:[48,56],el:[44,42],ha:[44,53],kn:[49,73],ft:[50,90]} },
    seat:{  env:'chair', envY:86, J:{hd:[44,17],nk:[44,24],sh:[45,31],hp:[51,57],el:[42,44],ha:[42,55],kn:[71,57],ft:[71,83]} },
    supine:{env:'mat',  envY:78, J:{hd:[23,72],nk:[29,72],sh:[35,72],hp:[58,72],el:[42,76],ha:[49,77],kn:[68,72],ft:[82,72]} },
    prone:{ env:'mat',  envY:82, J:{hd:[75,71],nk:[69,72],sh:[63,73],hp:[40,76],el:[65,79],ha:[67,80],kn:[27,78],ft:[18,79]} },
    side:{  env:'mat',  envY:80, J:{hd:[25,71],nk:[31,71],sh:[36,71],hp:[57,72],el:[45,71],ha:[52,70],kn:[66,72],ft:[80,72]} },
    quad:{  env:'floor',envY:83, J:{hd:[27,56],nk:[32,57],sh:[36,58],hp:[63,58],el:[35,70],ha:[34,82],kn:[64,70],ft:[65,82]} },
    kneel:{ env:'floor',envY:84, J:{hd:[52,23],nk:[52,30],sh:[52,37],hp:[52,57],el:[50,47],ha:[49,56],kn:[64,66],ft:[66,84],kn2:[45,83],ft2:[35,84]} },
    bust:{  env:'none', envY:0,  J:{hd:[50,36],nk:[50,48],sh:[50,57],hp:[50,80],kn:[50,80],ft:[50,80]} },
    // full-body FRONT view (for sideways leg movements that can't read in profile)
    front:{ env:'floor', envY:90, J:{hd:[50,14],nk:[50,21],sh:[50,29],hp:[50,55],
            el:[41,42],ha:[39,53],el2:[59,42],ha2:[61,53],kn:[45,72],ft:[44,89],kn2:[55,72],ft2:[56,89]} },
    // CLOSE-UP of forearm + hand on a table (for wrist/hand moves — a full body would
    // make the actual movement microscopically small)
    arm:{ env:'table', envY:60, J:{elb:[20,57],wr:[56,56],fg:[72,56]} }
  };
  // which way each base's figure is FACING (drives the nose). bust uses eyes instead.
  const FACE = { stand:[1,-0.12], seat:[1,-0.1], supine:[0.18,-1], prone:[0.4,1],
                 side:[1,-0.2], quad:[-0.25,1], kneel:[1,-0.12], bust:null, front:null, arm:null };

  // close-up forearm + hand (joints: elb=elbow, wr=wrist, fg=fingertips)
  function armFigure(J, color, opacity, headFill){
    let s = `<g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}">`;
    s += `<path d="M${J.elb[0]} ${J.elb[1]} L${J.wr[0]} ${J.wr[1]}" stroke-width="8"/>`;   // forearm
    s += `<path d="M${J.wr[0]} ${J.wr[1]} L${J.fg[0]} ${J.fg[1]}" stroke-width="6"/>`;     // hand
    s += `</g>`;
    s += `<g fill="${headFill}" stroke="none" opacity="${opacity}">`;
    s += `<circle cx="${J.elb[0]}" cy="${J.elb[1]}" r="4.2"/>`;
    s += `<circle cx="${J.fg[0]}" cy="${J.fg[1]}" r="3.2"/>`;
    s += `</g>`;
    return s;
  }

  /* environment drawing */
  function drawEnv(kind,y){
    const EF = "#d8dfe9";                                  // soft solid prop fill (prints in B&W)
    const floor = (x1,x2)=>`<rect x="${x1}" y="${y}" width="${x2-x1}" height="3.6" rx="1.8" fill="${EF}"/>`;
    if(kind==='mat')   return `<rect x="10" y="${(y-1.2).toFixed(1)}" width="82" height="6" rx="3" fill="${EF}"/>`;
    if(kind==='floor') return floor(8,92);
    if(kind==='chair') return `<g fill="${EF}" stroke="none">`
        + `<rect x="49" y="58" width="30" height="5" rx="2.5"/>`     // seat
        + `<rect x="74" y="34" width="5" height="29" rx="2.5"/>`     // backrest
        + `<rect x="51" y="63" width="4" height="22" rx="2"/>`       // front leg
        + `<rect x="74" y="63" width="4" height="22" rx="2"/>`       // back leg
        + `</g>` + floor(34,90);
    if(kind==='wall')      return `<rect x="74" y="12" width="5.5" height="${(y-12).toFixed(1)}" rx="2.5" fill="${EF}"/>` + floor(14,80);
    if(kind==='wall_left') return `<rect x="16" y="12" width="5.5" height="${(y-12).toFixed(1)}" rx="2.5" fill="${EF}"/>` + floor(20,86);
    if(kind==='table')     return `<rect x="6" y="${y}" width="52" height="4.5" rx="2" fill="${EF}"/>`
                                + `<rect x="12" y="${y+4}" width="4" height="${(92-y-4).toFixed(1)}" rx="2" fill="${EF}"/>`;
    return '';
  }

  /* ============ MOVES ============
     def: { base, env?, start?:{joint overrides}, end?:{joint overrides},
            arrow?: see below, hold?:true }
     arrow forms:
       {joint:'kn'}                  auto arrow from start.kn -> end.kn
       {joint:'kn', bow:6}           bowed
       {from:[x,y],to:[x,y],bow?}    explicit
       {arc:[cx,cy,r,a0,a1]}         rotation arc (radians)
       [a,b]                         array of multiple arrow defs
     If only `end` given (no start) it's a HOLD: solid figure + effort arrow.
  ============================================================ */
  function J(base, ov){ const j=B(BASE[base].J); if(ov) for(const k in ov) j[k]=ov[k].slice(); return j; }

  const MOVES = {
    /* ---- LUMBAR ---- */
    knee_to_chest:{ base:'supine',
      start:{kn:[68,66],ft:[82,70],el:[42,76],ha:[50,72]},
      end:{kn:[54,58],ft:[60,68],el:[40,66],ha:[52,60]},
      arrow:{joint:'kn',bow:7}, focus:'lowback' },
    double_knee_to_chest:{ base:'supine',
      start:{kn:[66,64],ft:[80,68],kn2:[66,60],ft2:[80,64],el:[42,74],ha:[52,66]},
      end:{kn:[52,58],ft:[58,66],kn2:[52,54],ft2:[58,62],el:[40,64],ha:[52,58]},
      arrow:{joint:'kn',bow:7}, focus:'lowback' },
    mckenzie_pressup:{ base:'prone',
      start:{hd:[72,75],nk:[66,76],sh:[60,77],el:[62,80],ha:[66,81]},
      end:{hd:[80,60],nk:[74,64],sh:[66,69],el:[66,80],ha:[67,81]},
      arrow:{joint:'sh',bow:-8}, focus:'lowback' },
    prone_pressup:{ base:'prone',
      start:{hd:[72,75],nk:[66,76],sh:[60,77],el:[62,80],ha:[66,81]},
      end:{hd:[79,63],nk:[73,66],sh:[66,71],el:[66,80],ha:[67,81]},
      arrow:{joint:'sh',bow:-7}, focus:'lowback' },
    // knees bent; low back visibly arched up off the mat (start) -> pressed flat (finish)
    pelvic_tilt:{ base:'supine',
      start:{kn:[66,62],ft:[72,76],sh:[36,69],hp:[57,69]},
      end:{kn:[66,62],ft:[72,76],sh:[36,73],hp:[57,74]},
      arrow:{from:[48,61],to:[48,70]}, focus:'lowback' },
    cat_cow:{ base:'quad',
      start:{nk:[32,59],sh:[36,60],hp:[63,60],hd:[27,60]},
      end:{nk:[32,53],sh:[40,52],hp:[60,53],hd:[27,55]},
      arrow:{from:[48,60],to:[48,50],bow:8}, focus:'upperback' },
    bird_dog:{ base:'quad',
      end:{el2:[20,54],ha2:[10,50],kn2:[80,62],ft2:[92,66]},
      start:{el2:[35,70],ha2:[34,82],kn2:[64,70],ft2:[65,82]},
      arrow:[{from:[24,58],to:[12,51]},{from:[78,64],to:[90,66]}], focus:'lowback' },
    lower_trunk_rotation:{ base:'supine',
      start:{kn:[60,58],ft:[60,70],hp:[58,72]},
      end:{kn:[60,80],ft:[74,82],hp:[58,74]},
      arrow:{from:[62,58],to:[68,78],bow:8}, focus:'lowback' },
    glute_bridge:{ base:'supine',
      start:{sh:[34,72],hp:[55,72],kn:[68,62],ft:[72,76]},
      end:{sh:[34,72],hp:[56,54],kn:[68,60],ft:[72,76]},
      arrow:{from:[56,68],to:[56,52],bow:4}, focus:'hip' },
    curl_up:{ base:'supine',
      start:{hd:[23,72],nk:[29,72],sh:[35,72]},
      end:{hd:[30,64],nk:[33,67],sh:[37,70]},
      arrow:{joint:'hd',bow:5}, focus:'lowback' },
    // Side plank: propped on forearm, body a straight diagonal, hips lifted off mat.
    side_plank:{ base:'side', hold:true,
      end:{hd:[24,52],nk:[29,55],sh:[34,58],hp:[55,68],kn:[69,73],ft:[84,78],
           el:[34,78],ha:[26,78]},
      arrow:{from:[55,78],to:[55,67]}, focus:'lowback' },
    childs_pose:{ base:'quad', hold:true,
      end:{hp:[66,62],sh:[40,66],nk:[35,68],hd:[29,70],el:[30,68],ha:[16,72],kn:[66,72],ft:[64,82]},
      arrow:{from:[40,64],to:[20,70],bow:6}, focus:'lowback' },
    // Dead bug: supine, knees/hips at 90 (tabletop) & arms vertical (ghost); extend opposite
    // arm overhead + opposite leg down toward floor (solid). Near arm/leg = the moving pair.
    // Near pair (arm + leg) stays in tabletop; far pair extends: arm reaches overhead (left),
    // opposite leg straightens out & down toward the mat (right). That diagonal is the dead-bug.
    dead_bug:{ base:'supine',
      start:{el:[34,62],ha:[34,52],kn:[56,56],ft:[56,66],
             el2:[36,62],ha2:[36,50],kn2:[58,56],ft2:[58,66]},
      end:{el:[34,62],ha:[34,52],kn:[56,56],ft:[56,66],
           el2:[26,66],ha2:[14,66],kn2:[72,66],ft2:[88,70]},
      arrow:[{from:[34,50],to:[16,64]},{from:[60,62],to:[86,70]}], focus:'lowback' },
    // Standing lumbar extension: hands on low back, lean the trunk backward (ghost upright -> solid arched).
    standing_lumbar_ext:{ base:'stand',
      start:{hd:[46,15],nk:[46,22],sh:[47,30],el:[50,40],ha:[50,52]},
      end:{hd:[54,16],nk:[52,23],sh:[50,31],hp:[48,56],el:[50,40],ha:[50,52]},
      arrow:{from:[48,20],to:[56,18],bow:-7}, focus:'lowback' },
    // Hip hinge: stand tall (ghost) -> hips push back, flat back tips forward, knees soft (solid).
    hip_hinge:{ base:'stand',
      start:{hd:[46,15],nk:[46,22],sh:[47,30],hp:[48,56],el:[44,42],ha:[44,53],kn:[49,73]},
      end:{hd:[28,30],nk:[33,32],sh:[39,35],hp:[58,52],el:[37,44],ha:[36,54],kn:[55,72],ft:[54,90]},
      arrow:[{from:[44,30],to:[34,34]},{from:[52,54],to:[60,52]}], focus:'lowback' },

    /* ---- HIP ---- */
    pigeon:{ base:'floor_custom' }, // defined specially below
    figure_four:{ base:'supine',
      start:{kn:[64,62],ft:[70,72],kn2:[60,58],ft2:[74,60]},
      end:{kn:[56,56],ft:[64,64],kn2:[52,62],ft2:[70,58]},
      arrow:{joint:'kn',bow:6}, focus:'hip' },
    // Seated figure-four / glute stretch: sit tall, ankle crossed over opposite knee, lean chest forward.
    seated_figure_four:{ base:'seat', hold:true,
      end:{hd:[40,20],nk:[41,26],sh:[43,32],hp:[51,57],
           kn:[66,60],ft:[66,83], kn2:[80,52],ft2:[60,57]},
      arrow:{from:[45,30],to:[55,40],bow:6}, focus:'hip' },
    hip_flexor_lunge:{ base:'kneel', hold:true,
      end:{hp:[50,58],sh:[50,38]},
      arrow:{from:[50,60],to:[42,62],bow:-5}, focus:'hip' },
    clamshell:{ base:'side',
      start:{kn:[64,70],ft:[58,80],kn2:[64,74],ft2:[58,82]},
      end:{kn:[60,60],ft:[58,80],kn2:[64,74],ft2:[58,82]},
      arrow:{from:[64,68],to:[60,58],bow:4}, focus:'hip' },
    sidelying_abduction:{ base:'side',
      start:{kn:[66,72],ft:[80,72],hp:[57,72]},
      end:{kn:[68,62],ft:[84,56],hp:[57,72]},
      arrow:{from:[82,72],to:[86,58],bow:4}, focus:'hip' },
    // FRONT view so the sideways leg lift actually reads sideways
    standing_abduction:{ base:'front',
      start:{},
      end:{kn2:[63,70],ft2:[71,83]},
      arrow:{from:[59,86],to:[71,80],bow:3}, focus:'hip' },
    standing_hip_ext:{ base:'stand',
      start:{kn:[49,73],ft:[50,90]},
      end:{kn:[40,74],ft:[30,86]},
      arrow:{from:[50,88],to:[32,84]}, focus:'hip' },
    // ball/pillow drawn between the knees so the squeeze has something to squeeze
    adduction_squeeze:{ base:'supine', hold:true,
      prop:'<circle cx="63" cy="58" r="4.5" fill="#c4cedc"/>',
      end:{kn:[66,61],ft:[71,73],kn2:[59,61],ft2:[68,74]},
      arrow:[{from:[53,57],to:[58,58]},{from:[73,56],to:[68,58]}], focus:'hip' },
    hip_marching:{ base:'stand',
      start:{kn:[49,73],ft:[50,90]},
      end:{kn:[58,60],ft:[60,72]},
      arrow:{from:[52,74],to:[58,60],bow:5}, focus:'hip' },
    hip_rotation_seated:{ base:'seat', end:{}, arrow:{arc:[60,64,12,-0.5,0.9]}, hold:true, focus:'hip' },
    // Fire hydrant: quadruped, lift bent far leg out to the side (knee stays ~90). Far leg moves up/out.
    fire_hydrant:{ base:'quad',
      start:{kn2:[64,70],ft2:[65,82]},
      end:{kn2:[78,60],ft2:[82,72]},
      arrow:{from:[66,68],to:[78,60],bow:-5}, focus:'hip' },
    // Monster / lateral band walk — FRONT view: feet hip-width, then one foot steps wide sideways
    monster_walk:{ base:'front',
      start:{hp:[50,58],kn:[45,73],ft:[44,88],kn2:[55,73],ft2:[56,88]},
      end:{hp:[52,58],kn:[45,73],ft:[44,88],kn2:[64,72],ft2:[70,88]},
      arrow:{from:[58,85],to:[70,85]}, focus:'hip' },
    // 90/90 hip stretch: seated on floor, front shin across, lean chest forward over front leg (hold).
    ninety_ninety:{ base:'stand', env:'floor', envY:84, hold:true,
      end:{hd:[36,52],nk:[40,55],sh:[44,58],hp:[54,72],el:[40,62],ha:[30,70],
           kn:[40,80],ft:[64,82],kn2:[68,80],ft2:[80,72]},
      arrow:{from:[46,56],to:[34,64],bow:6}, focus:'hip' },
    // Glute bridge with march: bridge held, one knee lifts toward chest while hips stay up.
    glute_march:{ base:'supine',
      start:{sh:[34,72],hp:[55,56],kn:[68,60],ft:[72,76],kn2:[68,60],ft2:[72,76]},
      end:{sh:[34,72],hp:[55,56],kn:[60,50],ft:[58,62],kn2:[68,60],ft2:[72,76]},
      arrow:{from:[66,58],to:[58,48],bow:5}, focus:'hip' },

    /* ---- KNEE ---- */
    quad_set:{ base:'supine', hold:true,
      end:{kn:[66,72],ft:[82,72]},
      arrow:{from:[52,68],to:[52,74]}, focus:'knee' },
    slr:{ base:'supine',
      start:{kn:[66,72],ft:[82,72]},
      end:{kn:[70,60],ft:[88,52]},
      arrow:{from:[80,72],to:[86,54],bow:5}, focus:'knee' },
    heel_slide:{ base:'supine',
      start:{kn:[80,72],ft:[88,72]},
      end:{kn:[64,62],ft:[66,72]},
      arrow:{from:[86,72],to:[68,72]}, focus:'knee' },
    // heel rests on a visible low stool; stand tall (start) -> hinge chest forward (finish)
    hamstring_stretch_stand:{ base:'stand',
      prop:'<rect x="64" y="68" width="16" height="20" rx="2" fill="#d8dfe9"/>',
      start:{kn:[58,70],ft:[70,66]},
      end:{hd:[55,26],nk:[53,32],sh:[51,38],hp:[44,54],el:[58,46],ha:[64,54],kn:[58,68],ft:[70,66]},
      arrow:{from:[50,26],to:[58,34],bow:5}, focus:'knee' },
    quad_stretch_stand:{ base:'stand', hold:true,
      end:{kn:[52,74],ft:[44,60],ha:[46,62],el:[48,54]},
      arrow:{from:[48,64],to:[44,58],bow:4}, focus:'knee' },
    // lean into the wall: hands on wall, front knee bent, back leg straight with heel down
    calf_stretch:{ base:'stand', env:'wall', envY:90, hold:true,
      end:{hd:[58,16],nk:[56,22],sh:[54,29],hp:[46,54],el:[62,36],ha:[72,40],kn:[58,70],ft:[64,88],kn2:[38,72],ft2:[26,88]},
      arrow:{from:[34,78],to:[28,87],bow:3}, focus:'knee' },
    // Wall sit: back flat against wall, hips & knees at 90°, thighs horizontal.
    wall_sit:{ base:'stand', env:'wall_left', envY:90, hold:true,
      end:{hd:[30,32],nk:[30,40],sh:[31,47],hp:[33,66],
           kn:[60,66],ft:[60,88],el:[44,57],ha:[58,58]},
      arrow:[{from:[40,72],to:[40,66]},{from:[33,58],to:[27,58]}], focus:'knee' },
    mini_squat:{ base:'stand',
      start:{hp:[48,56],kn:[49,73],ft:[50,90]},
      end:{hp:[48,62],kn:[52,74],ft:[50,90],sh:[46,38]},
      arrow:{from:[48,54],to:[48,62]}, focus:'knee' },
    // a visible step box; foot on the step (start) -> body rises up onto it (finish)
    step_up:{ base:'stand',
      prop:'<rect x="56" y="74" width="22" height="16" rx="2" fill="#d8dfe9"/>',
      start:{kn:[56,68],ft:[64,72]},
      end:{hd:[48,11],nk:[48,18],sh:[49,26],hp:[50,50],el:[46,38],ha:[46,49],
           kn:[56,64],ft:[64,72],kn2:[44,68],ft2:[40,84]},
      arrow:{from:[42,48],to:[42,34]}, focus:'knee' },
    ham_curl:{ base:'stand',
      start:{kn:[49,74],ft:[50,90]},
      end:{kn:[50,74],ft:[40,72]},
      arrow:{from:[50,88],to:[40,74],bow:5}, focus:'knee' },
    // Terminal knee extension: band visibly looped behind the knee, anchored out front;
    // knee starts softly bent, then straightens fully against the band.
    tke:{ base:'stand',
      prop:'<path d="M52 72 L10 70" stroke="#c4cedc" stroke-width="3" stroke-linecap="round" fill="none"/>',
      start:{kn:[55,71],ft:[50,90],hp:[48,56]},
      end:{kn:[49,74],ft:[50,90],hp:[48,56]},
      arrow:{from:[56,70],to:[50,74],bow:-3}, focus:'knee' },
    // Single-leg balance: stand on one leg, the other foot lifted off the floor (hold), arms steady.
    single_leg_balance:{ base:'stand', hold:true,
      end:{kn2:[40,70],ft2:[36,78],el:[40,42],ha:[36,52],kn:[49,73],ft:[50,90]},
      arrow:[{from:[42,82],to:[38,76]},{from:[60,90],to:[40,90]}], focus:'knee' },
    // Prone hamstring curl: face down, bend the knee bringing heel up toward the buttock.
    prone_ham_curl:{ base:'prone',
      start:{kn:[27,78],ft:[18,79]},
      end:{kn:[30,74],ft:[40,64]},
      arrow:{from:[20,78],to:[40,64],bow:6}, focus:'knee' },

    /* ---- SHOULDER ---- */
    // lean on a table with the good arm; the sore arm hangs straight down and swings
    pendulum:{ base:'stand', hold:true,
      prop:'<rect x="6" y="48" width="22" height="5" rx="2" fill="#d8dfe9"/><rect x="9" y="53" width="4" height="36" rx="2" fill="#d8dfe9"/>',
      end:{hd:[36,22],nk:[39,28],sh:[42,34],hp:[52,54],el:[33,42],ha:[26,47],
           el2:[44,46],ha2:[46,60],kn:[54,72],ft:[56,89],kn2:[48,72],ft2:[44,89]},
      arrow:{from:[38,62],to:[56,62],bow:6}, focus:'shoulder' },
    // FRONT view: arm pulled straight across the chest by the other hand
    cross_body_stretch:{ base:'front', hold:true,
      end:{el:[44,35],ha:[62,33],el2:[60,40],ha2:[52,35]},
      arrow:{from:[48,29],to:[60,30],bow:-3}, focus:'shoulder' },
    sleeper_stretch:{ base:'side', hold:true,
      end:{el:[44,64],ha:[40,78],sh:[40,64]},
      arrow:{from:[44,70],to:[42,80],bow:4}, focus:'shoulder' },
    // doorway/wall visible on the right; forearm on the frame, body leans forward through
    doorway_pec:{ base:'stand', env:'wall', envY:90, hold:true,
      end:{hd:[56,14],nk:[54,21],sh:[52,29],hp:[46,54],el:[64,30],ha:[71,19],el2:[64,36],ha2:[71,46],
           kn:[54,72],ft:[60,88],kn2:[40,73],ft2:[30,88]},
      arrow:{from:[44,33],to:[54,33]}, focus:'shoulder' },
    shoulder_flexion:{ base:'stand',
      start:{el:[44,42],ha:[44,53]},
      end:{el:[50,28],ha:[54,16]},
      arrow:{from:[44,48],to:[52,18],bow:8}, focus:'shoulder' },
    // FRONT view: elbow pinned at the side, forearm swings outward away from the belly
    external_rotation:{ base:'front',
      start:{el2:[59,42],ha2:[46,44]},
      end:{el2:[59,42],ha2:[75,42]},
      arrow:{from:[50,37],to:[72,37],bow:-6}, focus:'shoulder' },
    // FRONT view: elbow pinned at the side, forearm swings inward across the belly
    internal_rotation:{ base:'front',
      start:{el2:[59,42],ha2:[75,42]},
      end:{el2:[59,42],ha2:[46,44]},
      arrow:{from:[72,37],to:[50,37],bow:6}, focus:'shoulder' },
    // towel held vertically behind the back; top hand pulls the bottom hand upward
    towel_ir:{ base:'stand', hold:true,
      prop:'<path d="M39 31 L41 55" stroke="#c4cedc" stroke-width="3" stroke-linecap="round" fill="none"/>',
      end:{el:[40,21],ha:[39,30],el2:[42,46],ha2:[41,56]},
      arrow:{from:[47,52],to:[45,38],bow:-4}, focus:'shoulder' },
    scap_squeeze:{ base:'bust',
      start:{el:[40,67],ha:[42,79],el2:[60,67],ha2:[58,79]},
      end:{el:[31,65],ha:[36,77],el2:[69,65],ha2:[64,77]},
      arrow:[{from:[44,67],to:[32,65]},{from:[56,67],to:[68,65]}], focus:'upperback' },
    rows:{ base:'stand',
      start:{el:[56,40],ha:[64,36]},
      end:{el:[46,40],ha:[40,42]},
      arrow:{from:[62,38],to:[42,42]}, focus:'upperback' },
    wall_slide:{ base:'stand',
      start:{el:[40,44],ha:[42,34],el2:[56,44],ha2:[58,34]},
      end:{el:[44,30],ha:[46,18],el2:[56,30],ha2:[58,18]},
      arrow:{from:[50,36],to:[50,20]}, focus:'shoulder' },
    // Scaption raise: side view, arm raised ~30-45 deg forward of the body (scapular plane) to
    // shoulder height, thumb up. Ghost = arm down; solid = arm raised forward-up to shoulder line.
    scaption:{ base:'stand',
      start:{el:[45,40],ha:[46,52]},
      end:{el:[55,34],ha:[68,28]},
      arrow:{from:[48,48],to:[66,30],bow:8}, focus:'shoulder' },
    // Side-lying external rotation: lie on side, elbow pinned to side at 90, rotate forearm UP.
    sidelying_er:{ base:'side',
      start:{sh:[40,66],el:[46,70],ha:[58,72]},
      end:{sh:[40,66],el:[46,70],ha:[54,58]},
      arrow:{from:[58,70],to:[54,58],bow:5}, focus:'shoulder' },
    // Serratus punch: supine, arm points up, reach the weight higher by protracting the scapula.
    serratus_punch:{ base:'supine',
      start:{sh:[35,72],el:[37,60],ha:[39,49]},
      end:{sh:[35,72],el:[36,56],ha:[37,43]},
      arrow:{from:[38,52],to:[36,42]}, focus:'shoulder' },
    // Prone horizontal abduction: face down, arm hangs (ghost) then raises out to the side to
    // shoulder height, elbow straight (solid). "T" raise from a single arm.
    prone_horiz_abd:{ base:'prone',
      start:{sh:[63,73],el:[63,82],ha:[63,90]},
      end:{sh:[63,73],el:[63,64],ha:[63,55]},
      arrow:{from:[63,84],to:[63,57]}, focus:'shoulder' },

    /* ---- ELBOW / WRIST (close-up forearm views) ---- */
    // arm held out; the other hand (short stroke) pulls the hand down for the stretch
    wrist_flexor_stretch:{ base:'arm', env:'none', hold:true,
      prop:'<path d="M76 34 L70 46" stroke="#94a0b1" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="70" cy="47" r="2.6" fill="#94a0b1"/>',
      end:{elb:[16,42],wr:[56,42],fg:[66,58]},
      arrow:{from:[74,50],to:[70,60],bow:4}, focus:'wrist' },
    wrist_extensor_stretch:{ base:'arm', env:'none', hold:true,
      prop:'<path d="M76 34 L70 46" stroke="#94a0b1" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="70" cy="47" r="2.6" fill="#94a0b1"/>',
      end:{elb:[16,42],wr:[56,42],fg:[66,58]},
      arrow:{from:[74,50],to:[70,60],bow:4}, focus:'wrist' },
    // forearm on the table, hand over the edge: hand curls up / lowers down
    wrist_curl:{ base:'arm',
      start:{fg:[72,64]},
      end:{fg:[70,42]},
      arrow:{from:[78,58],to:[76,44],bow:-5}, focus:'wrist' },
    pronation_supination:{ base:'arm', hold:true,
      end:{fg:[70,50]},
      arrow:{arc:[68,50,10,-1.3,1.3]}, focus:'wrist' },
    grip:{ base:'arm', hold:true,
      prop:'<circle cx="67" cy="50" r="6" fill="#c4cedc"/>',
      end:{wr:[56,54],fg:[73,46]},
      arrow:[{from:[62,38],to:[65,45]},{from:[62,62],to:[65,56]}], focus:'wrist' },
    nerve_glide:{ base:'stand', hold:true,
      end:{sh:[47,34],el:[38,40],ha:[24,40]},
      arrow:{arc:[26,40,8,-1.4,1.0]}, focus:'wrist' },
    biceps_curl:{ base:'stand',
      start:{el:[46,42],ha:[48,54]},
      end:{el:[46,42],ha:[44,30]},
      arrow:{from:[48,52],to:[44,32],bow:5}, focus:'elbow' },
    // hand starts raised, then lowers slowly with control (the eccentric phase)
    eccentric_wrist:{ base:'arm',
      start:{fg:[70,42]},
      end:{fg:[72,64]},
      arrow:{from:[78,46],to:[78,60],bow:5}, focus:'wrist' },
    // Radial nerve glide: arm reaches down & behind, palm back, wrist flexed; head tilts away.
    radial_glide:{ base:'stand', hold:true,
      end:{sh:[47,32],el:[52,46],ha:[56,60],hd:[42,15],nk:[44,22]},
      arrow:{arc:[56,58,8,-1.3,0.6]}, focus:'wrist' },
    // Ulnar nerve glide: arm out to side, elbow & wrist bent bringing hand toward the face ("mask").
    ulnar_glide:{ base:'stand', hold:true,
      end:{sh:[47,34],el:[34,34],ha:[44,22]},
      arrow:{arc:[44,24,8,1.6,3.2]}, focus:'wrist' },
    // Wrist roller: arms forward holding a roller, wind a hanging weight up via wrist turns.
    wrist_roller:{ base:'stand', hold:true,
      end:{sh:[47,34],el:[40,38],ha:[58,38],el2:[47,34],ha2:[58,40]},
      arrow:[{arc:[58,39,7,-1.4,1.4]},{from:[58,52],to:[58,42]}], focus:'wrist' },
    // thumb sweeps across the palm and back (arc at the thumb side of the hand)
    thumb_stretch:{ base:'arm', hold:true,
      end:{fg:[70,48]},
      arrow:{arc:[64,46,9,-2.4,-0.6]}, focus:'wrist' },
    // rubber band loop around the fingers; fingers spread apart against it
    finger_ext_band:{ base:'arm', hold:true,
      prop:'<circle cx="69" cy="46" r="7" fill="none" stroke="#c4cedc" stroke-width="2.6"/>',
      end:{fg:[69,46]},
      arrow:[{from:[72,38],to:[78,32]},{from:[75,50],to:[82,53]}], focus:'wrist' },
    // ball of putty in the palm; arrows squeeze in from both sides
    therapy_putty:{ base:'arm', hold:true,
      prop:'<circle cx="67" cy="50" r="6" fill="#c4cedc"/>',
      end:{wr:[56,54],fg:[73,46]},
      arrow:[{from:[62,38],to:[65,45]},{from:[62,62],to:[65,56]}], focus:'wrist' },
    // hand rocks side to side at the wrist (thumb side <-> little-finger side)
    radial_ulnar_dev:{ base:'arm', hold:true,
      end:{fg:[70,52]},
      arrow:[{from:[76,46],to:[78,38],bow:-3},{from:[76,58],to:[78,66],bow:3}], focus:'wrist' },

    /* ---- THORACIC ---- */
    // foam roller visible under the upper back; head/shoulders arch back over it
    thoracic_ext_roller:{ base:'supine', hold:true,
      prop:'<circle cx="42" cy="72.5" r="5.5" fill="#c4cedc"/>',
      end:{hd:[27,68],nk:[34,66],sh:[42,67],hp:[60,76],el:[38,57],ha:[29,63],kn:[68,64],ft:[72,78]},
      arrow:{from:[32,58],to:[26,65],bow:-4}, focus:'upperback' },
    open_book:{ base:'side', end:{el:[44,60],ha:[40,48]}, start:{el:[46,71],ha:[52,70]},
      arrow:{arc:[40,62,14,1.2,2.8]}, focus:'upperback' },
    seated_rotation:{ base:'seat', hold:true, arrow:{arc:[46,40,13,-0.4,1.0]}, end:{}, focus:'upperback' },
    thread_needle:{ base:'quad', end:{el:[40,76],ha:[54,80],sh:[40,64]}, start:{el:[35,70],ha:[34,82]},
      arrow:{from:[40,72],to:[54,80]}, focus:'upperback' },
    wall_angels:{ base:'stand',
      start:{el:[40,44],ha:[42,34],el2:[56,44],ha2:[58,34]},
      end:{el:[44,30],ha:[46,18],el2:[56,30],ha2:[58,18]},
      arrow:{from:[50,36],to:[50,20]}, focus:'upperback' },
    prone_ytw:{ base:'prone',
      start:{el:[60,80],ha:[54,82],el2:[60,80],ha2:[54,82]},
      end:{el:[58,68],ha:[50,60],el2:[58,68],ha2:[50,60]},
      arrow:{from:[54,80],to:[50,62],bow:4}, focus:'upperback' },
    // Prone thoracic extension: lift chest & head off the mat, hands by the sides.
    thoracic_extension:{ base:'prone',
      start:{hd:[78,74],nk:[72,75],sh:[65,76],el:[66,80],ha:[60,82]},
      end:{hd:[82,60],nk:[75,64],sh:[67,70],el:[64,78],ha:[58,82]},
      arrow:{from:[74,74],to:[80,60],bow:-6}, focus:'upperback' },
    // Band pull-apart: arms straight out front (ghost) sweep apart to a wide T (solid). Front-view bust.
    band_pull_apart:{ base:'bust',
      start:{el:[44,57],ha:[34,57],el2:[56,57],ha2:[66,57]},
      end:{el:[34,57],ha:[18,57],el2:[66,57],ha2:[82,57]},
      arrow:[{from:[33,57],to:[20,57]},{from:[67,57],to:[80,57]}], focus:'upperback' },
    // Seated thoracic extension over chair-back: mid-back arches backward over the backrest edge.
    seated_thor_ext:{ base:'seat',
      start:{hd:[44,17],nk:[44,24],sh:[45,31],el:[44,20],ha:[46,12]},
      end:{hd:[52,16],nk:[49,23],sh:[47,31],el:[50,18],ha:[52,10]},
      arrow:{from:[45,18],to:[53,16],bow:-7}, focus:'upperback' },
    // Sphinx pose: prone, propped on forearms (elbows under shoulders), chest lifted — a static hold.
    sphinx:{ base:'prone', hold:true,
      end:{hd:[82,60],nk:[76,63],sh:[69,67],el:[70,80],ha:[80,72],hp:[40,78]},
      arrow:{from:[74,68],to:[80,61],bow:-5}, focus:'upperback' },

    /* ---- CERVICAL ---- */
    // Chin tuck / retraction — SIDE view (front view can't show a front-back glide):
    // seated, head poking forward (start) -> head drawn straight back over shoulders (finish).
    chin_tuck:{ base:'seat',
      start:{hd:[52,19],nk:[47,25]},
      end:{hd:[43,16],nk:[44,24]},
      arrow:{from:[56,14],to:[46,11],bow:-3}, focus:'neck' },
    // Active rotation: head turns to one side — arc swept above the head.
    neck_rotation:{ base:'bust', hold:true,
      arrow:{arc:[50,50,18,-2.5,-0.7]}, end:{hd:[59,35]}, focus:'neck' },
    // Side bend: ear toward shoulder — whole head tilts down to one side.
    neck_sidebend:{ base:'bust',
      start:{hd:[50,34],nk:[50,48]}, end:{hd:[37,40],nk:[45,49]},
      arrow:{from:[52,29],to:[36,35],bow:-6}, focus:'neck' },
    // Flexion / small nod — SIDE view: seated, chin tips gently down toward the chest.
    neck_flex_nod:{ base:'seat',
      start:{hd:[45,16],nk:[44,24]}, end:{hd:[49,20],nk:[45,25]},
      arrow:{from:[51,13],to:[55,19],bow:4}, focus:'neck' },
    // Isometric press: hand resists the head, no movement.
    neck_iso:{ base:'bust', hold:true,
      end:{el2:[60,45],ha2:[45,37]},
      arrow:[{from:[40,36],to:[46,36]},{from:[51,36],to:[45,36]}], focus:'neck' },
    deep_neck_flexor:{ base:'supine', hold:true,
      end:{hd:[25,68],nk:[30,70]},
      arrow:{from:[24,72],to:[25,67],bow:3}, focus:'neck' },

    /* Prone cervical extension: face-down, chin tucked, lift forehead a small amount.
       Ghost = head resting on towel; solid = forehead lifted with neck long. */
    prone_cerv_ext:{ base:'prone',
      start:{hd:[80,75],nk:[73,75],sh:[65,76],el:[68,80],ha:[74,80]},
      end:{hd:[83,67],nk:[75,71],sh:[65,76],el:[68,80],ha:[74,80]},
      arrow:{from:[81,75],to:[84,67],bow:-4}, focus:'neck' },
    /* Cervical flexion stretch — SIDE view: seated, chin dropped to chest, hand resting
       on the back of the head guiding it gently down. */
    cerv_flex_stretch:{ base:'seat', hold:true,
      end:{hd:[50,21],nk:[46,26],el:[54,34],ha:[50,18]},
      arrow:{from:[58,18],to:[54,26],bow:5}, focus:'neck' },
    /* Chin tuck against band — same side-view retraction; band runs forward to its anchor. */
    chin_tuck_band:{ base:'seat',
      start:{hd:[52,19],nk:[47,25]},
      end:{hd:[43,16],nk:[44,24]},
      arrow:[{from:[56,14],to:[46,11],bow:-3},{from:[52,17],to:[70,17]}], focus:'neck' }
  };

  /* exercise-name -> move key. Matched by substring (first hit wins). */
  const MAP = [
    // lumbar
    ["McKenzie","mckenzie_pressup"],["Prone Press-Up","prone_pressup"],
    ["Double Knee to Chest","double_knee_to_chest"],["Knee to Chest","knee_to_chest"],
    ["Posterior Pelvic Tilt","pelvic_tilt"],["Lower Trunk Rotation","lower_trunk_rotation"],
    ["Bird Dog","bird_dog"],["Curl-Up","curl_up"],["Side Plank","side_plank"],["Child's Pose","childs_pose"],
    ["Dead Bug","dead_bug"],["Standing Lumbar Extension","standing_lumbar_ext"],["Hip Hinge","hip_hinge"],
    // hip
    ["Pigeon","pigeon"],["Figure-Four","figure_four"],["Piriformis (Figure","figure_four"],
    ["Kneeling Hip Flexor","hip_flexor_lunge"],["Clamshell","clamshell"],
    ["Side-Lying Hip Abduction","sidelying_abduction"],["Standing Hip Abduction","standing_abduction"],
    ["Standing Hip Extension","standing_hip_ext"],["Hip Adduction","adduction_squeeze"],
    ["Hip Flexion Marching","hip_marching"],["Seated Piriformis","seated_figure_four"],
    ["Hip Internal/External","hip_rotation_seated"],
    ["Fire Hydrant","fire_hydrant"],["Lateral Band Walk","monster_walk"],["Monster Walk","monster_walk"],
    ["90/90 Hip Stretch","ninety_ninety"],["Glute Bridge with March","glute_march"],
    // knee
    ["Quad Set","quad_set"],["Straight Leg Raise","slr"],["Heel Slide","heel_slide"],
    ["Standing Hamstring","hamstring_stretch_stand"],["Standing Quadriceps","quad_stretch_stand"],
    ["Calf Stretch","calf_stretch"],["Wall Sit","wall_sit"],["Mini Squat","mini_squat"],
    ["Step-Up","step_up"],
    ["Prone Hamstring Curl","prone_ham_curl"],["Hamstring Curl","ham_curl"],
    ["Terminal Knee Extension","tke"],["Single-Leg Balance","single_leg_balance"],
    // shoulder
    ["Pendulum","pendulum"],["Cross-Body","cross_body_stretch"],["Sleeper","sleeper_stretch"],
    ["Doorway Pectoral","doorway_pec"],["Scapular Squeeze","scap_squeeze"],
    ["Resisted External Rotation","external_rotation"],["Resisted Internal Rotation","internal_rotation"],
    ["Resisted Rows","rows"],["Wall Slides","wall_slide"],["Prone Y and T","prone_ytw"],
    ["Towel Internal Rotation","towel_ir"],
    ["Scaption Raise","scaption"],["Side-Lying External Rotation","sidelying_er"],
    ["Serratus Punch","serratus_punch"],["Prone Horizontal Abduction","prone_horiz_abd"],
    // elbow / wrist
    ["Eccentric Wrist Extension","eccentric_wrist"],["Eccentric Wrist Flexion","eccentric_wrist"],
    ["Tyler Twist","pronation_supination"],["Forearm Pronation","pronation_supination"],
    ["Grip Strengthening","grip"],["Elbow Flexion","biceps_curl"],["Biceps Curl","biceps_curl"],
    ["Median Nerve Glide","nerve_glide"],["Radial Nerve Glide","radial_glide"],
    ["Ulnar Nerve Glide","ulnar_glide"],["Wrist Roller","wrist_roller"],["Tendon Glide","grip"],
    ["Wrist Flexor Stretch","wrist_flexor_stretch"],["Wrist Extensor Stretch","wrist_extensor_stretch"],
    ["Wrist Curl","wrist_curl"],["Reverse Wrist Curl","wrist_curl"],["Wrist Flexion / Extension","wrist_curl"],
    ["Prayer Stretch","wrist_flexor_stretch"],["Radial and Ulnar","radial_ulnar_dev"],
    ["Thumb Stretch","thumb_stretch"],["Finger Extension with Rubber Band","finger_ext_band"],
    ["Therapy Putty","therapy_putty"],
    // thoracic
    ["Thoracic Extension over Foam","thoracic_ext_roller"],["Foam Roller Thoracic","thoracic_ext_roller"],
    ["Open Book","open_book"],["Seated Thoracic Rotation","seated_rotation"],
    ["Quadruped Thoracic Rotation","thread_needle"],["Thread the Needle","thread_needle"],
    ["Wall Angels","wall_angels"],["Prone Y-T-W","prone_ytw"],["Cat-Cow","cat_cow"],
    ["Prone Thoracic Extension","thoracic_extension"],
    ["Standing Rows","rows"],["Pectoral Doorway","doorway_pec"],
    ["Band Pull-Apart","band_pull_apart"],["Seated Thoracic Extension over Chair","seated_thor_ext"],
    ["Sphinx","sphinx"],
    // cervical
    ["Chin Tuck with Band","chin_tuck_band"],["Chin Tuck","chin_tuck"],["Cervical Retraction","chin_tuck"],
    ["Prone Cervical Extension","prone_cerv_ext"],["Cervical Flexion Stretch","cerv_flex_stretch"],
    ["Cervical Rotation","neck_rotation"],["Upper Trapezius","neck_sidebend"],
    ["Levator Scapulae","neck_rotation"],["Scalene","neck_sidebend"],["Cervical Side Bend","neck_sidebend"],
    ["Deep Neck Flexor","deep_neck_flexor"],["Isometric Neck","neck_iso"],
    ["Suboccipital","neck_flex_nod"],["Shoulder Blade Squeeze","scap_squeeze"],
    // generic glute bridge (lumbar & hip)
    ["Glute Bridge","glute_bridge"]
  ];

  function moveFor(ex){
    for(const [k,v] of MAP){ if(ex.name.indexOf(k)>=0) return v; }
    return null;
  }

  /* plain-language action word shown under the FINISH picture (kept short) */
  const CUES = {
    knee_to_chest:"PULL KNEE IN", double_knee_to_chest:"PULL KNEES IN",
    mckenzie_pressup:"PRESS UP", prone_pressup:"PRESS UP", pelvic_tilt:"FLATTEN BACK",
    cat_cow:"ARCH & ROUND", bird_dog:"REACH OUT", lower_trunk_rotation:"DROP KNEES",
    glute_bridge:"LIFT HIPS", curl_up:"LIFT HEAD", hip_hinge:"HINGE BACK",
    standing_lumbar_ext:"LEAN BACK", dead_bug:"REACH OUT",
    figure_four:"PULL IN", clamshell:"OPEN KNEE", sidelying_abduction:"LIFT LEG",
    standing_abduction:"LIFT LEG OUT", standing_hip_ext:"LEG BACK", hip_marching:"LIFT KNEE",
    fire_hydrant:"LIFT KNEE OUT", monster_walk:"STEP WIDE", glute_march:"LIFT KNEE",
    slr:"LIFT LEG", heel_slide:"SLIDE HEEL IN", hamstring_stretch_stand:"REACH FORWARD",
    mini_squat:"BEND KNEES", step_up:"STEP UP", ham_curl:"BEND KNEE",
    tke:"STRAIGHTEN", prone_ham_curl:"BEND KNEE",
    pendulum:"SWING", shoulder_flexion:"RAISE ARM", external_rotation:"ROTATE OUT",
    internal_rotation:"ROTATE IN", scap_squeeze:"SQUEEZE BACK", rows:"PULL BACK",
    wall_slide:"SLIDE UP", scaption:"RAISE ARM", sidelying_er:"ROTATE UP",
    serratus_punch:"REACH UP", prone_horiz_abd:"RAISE ARM",
    wrist_curl:"CURL UP", biceps_curl:"CURL UP", eccentric_wrist:"LOWER SLOW",
    open_book:"OPEN UP", thread_needle:"REACH UNDER", wall_angels:"SLIDE UP",
    prone_ytw:"LIFT ARMS", thoracic_extension:"LIFT CHEST", band_pull_apart:"PULL APART",
    seated_thor_ext:"ARCH BACK", chin_tuck:"TUCK CHIN", chin_tuck_band:"TUCK CHIN",
    neck_sidebend:"TILT HEAD", neck_flex_nod:"DROP CHIN", prone_cerv_ext:"LIFT HEAD",
    /* action words for single-panel moves that aren't true holds */
    neck_rotation:"TURN HEAD", seated_rotation:"TURN BODY", pronation_supination:"TURN PALM",
    hip_rotation_seated:"DROP KNEES", radial_ulnar_dev:"ROCK HAND", grip:"SQUEEZE",
    therapy_putty:"SQUEEZE", finger_ext_band:"SPREAD FINGERS", thumb_stretch:"STRETCH THUMB",
    wrist_roller:"ROLL UP", adduction_squeeze:"SQUEEZE KNEES", quad_set:"TIGHTEN THIGH",
    neck_iso:"PRESS HEAD", deep_neck_flexor:"LIFT HEAD", single_leg_balance:"BALANCE",
    thoracic_ext_roller:"ARCH BACK", pendulum:"SWING ARM", cross_body_stretch:"PULL ACROSS",
    towel_ir:"PULL UP", doorway_pec:"LEAN FORWARD", hamstring_stretch_stand:"LEAN FORWARD",
    wrist_flexor_stretch:"PULL HAND DOWN", wrist_extensor_stretch:"PULL HAND DOWN"
  };

  /* region -> zone -> approx body point on the SOLID figure (per base) */
  const ZONE = { cervical:"neck", thoracic:"upperback", lumbar:"lowback", hip:"hip",
                 shoulder:"shoulder", elbow:"elbow", wrist:"wrist", knee:"knee" };
  function focusPoint(J, zone){
    if(J.elb) return zone==='elbow' ? J.elb : J.wr;   // arm close-up joints
    switch(zone){
      case 'neck': return [J.nk[0],(J.hd[1]+J.nk[1])/2];
      case 'upperback': return lerp(J.nk,J.hp,0.32);
      case 'lowback': return lerp(J.nk,J.hp,0.78);
      case 'hip': return J.hp;
      case 'shoulder': return J.sh;
      case 'elbow': return J.el;
      case 'wrist': return J.ha;
      case 'knee': return J.kn;
    }
    return J.hp;
  }

  /* ---- special-case pigeon: full start/end joint sets (kneeling -> forward fold) ---- */
  function pigeonPoses(){
    const hp=[54,64], legs={kn:[34,78],ft:[58,82],kn2:[70,76],ft2:[90,82]};
    const sJ={ hd:[54,34],nk:[54,42],sh:[53,50],hp:hp, el:[50,58],ha:[47,70], ...legs };
    const eJ={ hd:[30,58],nk:[37,57],sh:[44,55],hp:hp, el:[34,62],ha:[24,70], ...legs };
    return {sJ,eJ};
  }

  /* ============ base detection (fallback only) ============ */
  function detectBase(ex){
    const mv = moveFor(ex); if(mv && MOVES[mv]) return MOVES[mv].base==='floor_custom'?'kneel':MOVES[mv].base;
    const t=((ex.name||'')+' '+(ex.instructions||[]).join(' ')).toLowerCase();
    if(/hands and knees|quadruped|bird ?dog|cat-?cow|thread|all fours/.test(t)) return 'quad';
    if(/on your side|side-?lying|clamshell|open book/.test(t)) return 'side';
    if(/face down|prone|press-?up/.test(t)) return 'prone';
    if(/on your back|supine|lie with|lie on your back/.test(t)) return 'supine';
    if(/kneel/.test(t)) return 'kneel';
    if(/\bstand|doorway|wall/.test(t)) return 'stand';
    if(/\bsit|seated/.test(t)) return 'seat';
    return 'stand';
  }

  function drawArrowDef(def, sJ, eJ){
    if(!def) return '';
    if(Array.isArray(def)) return def.map(d=>drawArrowDef(d,sJ,eJ)).join('');
    if(def.arc){ const [cx,cy,r,a0,a1]=def.arc; return arc(cx,cy,r,a0,a1,ARROW); }
    let A=def.from, Bp=def.to;
    if(def.joint){ A = (sJ&&sJ[def.joint])||eJ[def.joint]; Bp = eJ[def.joint]; }
    if(!A||!Bp) return '';
    return arrow(A,Bp,def.bow||0,ARROW);
  }

  function highlight(fp,accent){
    return `<circle cx="${fp[0].toFixed(1)}" cy="${fp[1].toFixed(1)}" r="11" fill="${accent}" opacity="0.18"/>`
         + `<circle cx="${fp[0].toFixed(1)}" cy="${fp[1].toFixed(1)}" r="3.6" fill="${accent}" stroke="#fff" stroke-width="1.6"/>`;
  }

  /* ============ resolve an exercise to {ctx, sJ, eJ, isHold} ============ */
  function resolve(ex){
    const accent = TYPE_COLOR[ex.type] || "#2563eb";
    const mvKey = moveFor(ex);
    if(mvKey === 'pigeon'){
      const {sJ,eJ} = pigeonPoses();
      return { sJ, eJ, isHold:false,
        ctx:{ env:'mat', envY:84, focus:'hip', arrow:{from:[52,48],to:[38,55],bow:7}, accent, drawFig:figure, face:null, cue:'FOLD FORWARD' } };
    }
    if(mvKey && MOVES[mvKey]){
      const def = MOVES[mvKey];
      const baseEnv = BASE[def.base];
      const drawFig = (def.base==='bust') ? bustFigure : (def.base==='arm') ? armFigure : figure;
      const eJ = J(def.base, def.end||{});
      const sJ = def.start ? J(def.base, def.start) : null;
      return { sJ, eJ, isHold: !!def.hold || !def.start,
        ctx:{ env:def.env||baseEnv.env, envY:def.envY||baseEnv.envY,
              focus:def.focus||ZONE[ex.region]||'lowback', arrow:def.arrow, accent, drawFig,
              face:FACE[def.base], cue:CUES[mvKey], prop:def.prop } };
    }
    // fallback — static posed figure (no defined movement)
    const base = detectBase(ex);
    return { sJ:null, eJ:J(base,{}), isHold:true,
      ctx:{ env:BASE[base].env, envY:BASE[base].envY, focus:ZONE[ex.region]||'lowback', arrow:null, accent, drawFig:figure, face:FACE[base], cue:null } };
  }

  // one figure scene inside a 0..100 panel: environment, body, and (on the end frame) the target + arrow
  function scene(Jp, ctx, isEnd, sJ){
    let s = drawEnv(ctx.env, ctx.envY);
    if(ctx.prop) s += ctx.prop;                       // extra equipment (roller, ball, ...)
    s += ctx.drawFig(Jp, INK, 1, INK_H, ctx.face);
    if(isEnd){
      s += highlight(focusPoint(Jp, ctx.focus), ctx.accent);
      s += drawArrowDef(ctx.arrow, sJ, Jp);
    }
    return s;
  }

  // a framed panel (rounded card + scene + optional number badge + caption)
  function frame(dx, inner, num, label){
    let s = `<g transform="translate(${dx},0)">`;
    s += `<rect x="1.5" y="1.5" width="97" height="97" rx="10" fill="#fafbfd" stroke="#e2e8f0" stroke-width="1.2"/>`;
    s += inner;
    if(num){
      s += `<circle cx="12.5" cy="12.5" r="8.2" fill="${ARROW}"/>`;
      s += `<text x="12.5" y="16" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="10.5" font-weight="700" fill="#fff">${num}</text>`;
    }
    s += `<text x="50" y="113" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" fill="#475569" letter-spacing="0.6">${label}</text>`;
    s += `</g>`;
    return s;
  }

  // connector arrow between the two panels
  function connector(){
    const y=48;
    return `<path d="M${STRIP_GAP_X+1} ${y} L${STRIP_GAP_X+16} ${y}" stroke="${ARROW}" stroke-width="4" stroke-linecap="round" fill="none"/>`
         + head_(STRIP_GAP_X+21, y, 0, ARROW, 8.5);
  }
  const PANEL=100, GAP=40, STRIP_GAP_X=PANEL+9, STRIP_W=PANEL*2+GAP, STRIP_H=120;

  function svgWrap(w,h,cls,label,inner){
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" class="${cls}" role="img" aria-label="${(label||'').replace(/"/g,'')} diagram" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
  }

  window.exerciseSVG = function(ex, size, variant){
    const R = resolve(ex);

    // THUMBNAIL (app cards / program list) — a single small icon of the working position
    if(variant === 'thumb'){
      let s = `<rect x="0" y="0" width="100" height="100" rx="12" fill="#f1f5f9"/>`;
      s += scene(R.eJ, R.ctx, true, R.sJ);
      return svgWrap(100,100,'ex-svg',ex.name,s);
    }

    // TEACHING STRIP (handout) — two labelled steps, or one panel for a hold
    if(R.isHold || !R.sJ){
      const inner = scene(R.eJ, R.ctx, true, R.sJ);
      const content = frame(12, inner, null, R.ctx.cue || 'HOLD POSITION');
      return svgWrap(PANEL+24, STRIP_H, 'ex-strip', ex.name, content);
    }
    let content = frame(0, scene(R.sJ, R.ctx, false, null), '1', 'START');
    content += frame(PANEL+GAP, scene(R.eJ, R.ctx, true, R.sJ), '2', R.ctx.cue||'FINISH');
    content += connector();
    return svgWrap(STRIP_W, STRIP_H, 'ex-strip', ex.name, content);
  };

  window.exercisePose = detectBase;
})();
