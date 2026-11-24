/* Generated from mvp/mvp-seed-content.json + eval-v3-full/payloads/pumping_synth.json (verified content, verbatim). Do not hand-edit. */
window.VL_CONTENT = {
 "document": {
  "title": "Motor Driven Systems \u2014 affinity laws (demo)",
  "subject": "Energy \u2014 MDS",
  "sourceTextFile": "~/workspace/money-venture/visualearn/eval-v3-full/payloads/pumping_synth.json",
  "sourceTextNote": "The authorised synthetic test document 'Pumping Systems \u2014 Energy, Efficiency and the Affinity Laws (synthetic replacement text)', 4 pages. Use its pages verbatim as the document's source text in the Source view.",
  "topics": [
   {
    "title": "The affinity laws",
    "sourcePages": [
     1
    ],
    "summary": "For centrifugal fans and pumps: flow varies directly with speed (Q \u221d N), pressure varies with speed squared (P \u221d N\u00b2), and power varies with speed cubed (W \u221d N\u00b3). Double the speed and flow doubles, pressure quadruples, power rises eightfold."
   },
   {
    "title": "The cube law & energy savings",
    "sourcePages": [
     2
    ],
    "summary": "Because power follows the cube of speed, small speed reductions give outsized savings: a 20% speed cut leaves power at 0.8\u00b3 = 51.2% \u2014 a saving of about 49%. This is why slowing a fan or pump beats throttling it."
   },
   {
    "title": "Motors, load & efficiency",
    "sourcePages": [
     3
    ],
    "summary": "A motor's efficiency peaks near 75\u2013100% of rated load and falls off at low load, with power factor dropping even faster. Chronically oversized motors waste energy and attract low-load penalties \u2014 right-sizing and matching duty matter."
   },
   {
    "title": "Variable speed drives (VSD)",
    "sourcePages": [
     4
    ],
    "summary": "A VSD matches motor speed to actual demand instead of running flat-out against a damper or throttle valve, which simply burns the surplus as pressure loss. VSD savings are largest where demand varies and the system curve is friction-dominated."
   }
  ],
  "edges": [
   {
    "from": "The affinity laws",
    "relation": "power term gives",
    "to": "The cube law & energy savings"
   },
   {
    "from": "The cube law & energy savings",
    "relation": "is exploited by",
    "to": "Variable speed drives (VSD)"
   },
   {
    "from": "Motors, load & efficiency",
    "relation": "is matched by",
    "to": "Variable speed drives (VSD)"
   },
   {
    "from": "The affinity laws",
    "relation": "sets the load the motor sees",
    "to": "Motors, load & efficiency"
   }
  ],
  "questions": [
   {
    "kind": "numerical",
    "topicTitle": "The affinity laws",
    "sourcePage": 1,
    "prompt": "A centrifugal pump delivers 120 L/s at 2,900 rpm. Using the affinity laws, calculate the flow in L/s when the speed is reduced to 2,320 rpm.",
    "answer": 96,
    "unit": "L/s",
    "explanation": "Flow varies directly with speed: Q\u2082 = Q\u2081 \u00d7 (N\u2082/N\u2081) = 120 \u00d7 (2320/2900) = 120 \u00d7 0.8 = 96 L/s. Verified by direct substitution into the first affinity law.",
    "misconceptionTag": "Uses the square or cube law for flow"
   },
   {
    "kind": "numerical",
    "topicTitle": "The affinity laws",
    "sourcePage": 1,
    "prompt": "A fan develops a pressure of 640 Pa at full speed. Calculate the pressure in Pa when it runs at 75% of full speed.",
    "answer": 360,
    "unit": "Pa",
    "explanation": "Pressure varies with speed squared: P\u2082 = 640 \u00d7 0.75\u00b2 = 640 \u00d7 0.5625 = 360 Pa. Verified by direct substitution into the second affinity law.",
    "misconceptionTag": "Uses the linear law for pressure"
   },
   {
    "kind": "numerical",
    "topicTitle": "The cube law & energy savings",
    "sourcePage": 2,
    "prompt": "A fan draws 8.0 kW at full speed. Its speed is reduced by 20% with a VSD. Calculate the new power draw in kW.",
    "answer": 4.096,
    "unit": "kW",
    "explanation": "Power varies with speed cubed: W\u2082 = 8.0 \u00d7 0.8\u00b3 = 8.0 \u00d7 0.512 = 4.096 kW \u2248 4.1 kW \u2014 nearly half the power gone for a fifth less speed. Verified by direct substitution into the cube law.",
    "misconceptionTag": "Assumes power falls linearly with speed"
   },
   {
    "kind": "mcq",
    "topicTitle": "The cube law & energy savings",
    "sourcePage": 2,
    "prompt": "A fan's speed is halved. By the affinity laws, its power draw becomes:",
    "options": [
     "One half of before",
     "One quarter of before",
     "One eighth of before",
     "Unchanged \u2014 only flow changes"
    ],
    "correctIndex": 2,
    "explanation": "Power \u221d N\u00b3, so (\u00bd)\u00b3 = \u215b. Halving the speed cuts power to one eighth \u2014 the single most useful fact in fan and pump energy work.",
    "misconceptionTag": "Assumes power falls linearly with speed"
   },
   {
    "kind": "numerical",
    "topicTitle": "Variable speed drives (VSD)",
    "sourcePage": 4,
    "prompt": "A pump motor draws 20 kW at full speed and runs 4,000 hours per year. A VSD cuts its speed by 10% year-round. Calculate the annual energy saving in kWh.",
    "answer": 21680,
    "unit": "kWh",
    "explanation": "New power = 20 \u00d7 0.9\u00b3 = 20 \u00d7 0.729 = 14.58 kW. Saving = (20 \u2212 14.58) \u00d7 4,000 = 5.42 \u00d7 4,000 = 21,680 kWh per year. Verified by direct substitution into the cube law.",
    "misconceptionTag": "Forgets to convert power saving into energy over time"
   },
   {
    "kind": "mcq",
    "topicTitle": "Motors, load & efficiency",
    "sourcePage": 3,
    "prompt": "A 30 kW motor is fitted to a load that never exceeds 9 kW. What is the main energy concern?",
    "options": [
     "None \u2014 a bigger motor is always safer",
     "It runs at ~30% load, where efficiency sags and power factor drops sharply",
     "It will draw 30 kW continuously regardless of load",
     "It will run faster than the load allows"
    ],
    "correctIndex": 1,
    "explanation": "Motor efficiency peaks near 75\u2013100% load and power factor falls steeply at low load. The motor draws what the load needs plus its losses \u2014 it does not draw its full rating \u2014 but chronic oversizing wastes energy. Right-sizing or a VSD is the fix.",
    "misconceptionTag": "Believes a motor always draws its rated power"
   }
  ],
  "flashcards": [
   {
    "front": "State the three affinity laws for a centrifugal fan or pump.",
    "back": "Flow Q \u221d N (speed). Pressure P \u221d N\u00b2. Power W \u221d N\u00b3. Double the speed: flow \u00d72, pressure \u00d74, power \u00d78.",
    "topicTitle": "The affinity laws",
    "sourcePage": 1
   },
   {
    "front": "A pump delivers 120 L/s at 2,900 rpm. What flow does it deliver at 2,320 rpm?",
    "back": "Speed ratio = 2320/2900 = 0.8. Flow scales linearly: 120 \u00d7 0.8 = 96 L/s.",
    "topicTitle": "The affinity laws",
    "sourcePage": 1
   },
   {
    "front": "Why does a 20% speed reduction save far more than 20% of the power?",
    "back": "Power follows the cube law: 0.8\u00b3 = 0.512, so power falls to 51.2% \u2014 a saving of about 49%, not 20%.",
    "topicTitle": "The cube law & energy savings",
    "sourcePage": 2
   },
   {
    "front": "A fan draws 8.0 kW at full speed. Estimate its draw at 80% speed.",
    "back": "8.0 \u00d7 0.8\u00b3 = 8.0 \u00d7 0.512 = 4.1 kW.",
    "topicTitle": "The cube law & energy savings",
    "sourcePage": 2
   },
   {
    "front": "Why is a chronically oversized motor an energy problem?",
    "back": "Efficiency peaks near full load and sags at low load, while power factor falls even faster \u2014 an oversized motor idling at 30% load wastes energy and can attract low-load penalties.",
    "topicTitle": "Motors, load & efficiency",
    "sourcePage": 3
   },
   {
    "front": "Why does a VSD beat a damper for flow control on a fan?",
    "back": "A damper keeps the fan at full speed and burns the surplus as pressure loss. A VSD slows the fan, and by the cube law the power falls far faster than the flow.",
    "topicTitle": "Variable speed drives (VSD)",
    "sourcePage": 4
   }
  ]
 },
 "sourceTitle": "Pumping Systems \u2014 Energy, Efficiency and the Affinity Laws (synthetic replacement text)",
 "sourcePages": [
  {
   "page": 1,
   "text": "1. What a pump does\nA pump is a machine used for raising the pressure of an incompressible fluid and for transporting liquids from one location to another. A pump operates by converting mechanical energy, supplied at its shaft by an electric motor or another driver, into hydraulic energy carried by the fluid. Pumps are widely used in buildings and industrial plants, and together they account for a significant portion of the energy consumed by motor-driven systems. In buildings, pumps mainly provide water for heat transfer in air-conditioning and heating systems: chilled-water and condenser-water pumps circulate water between chillers, cooling towers and air-handling equipment, while heating pumps circulate hot water to radiators and coils. In industrial plants, pumps serve cooling and hydraulic systems and transfer liquids through process lines, and utility companies use large pumps for water supply and distribution.\n2. Flow, pressure and hydraulic power"
  },
  {
   "page": 2,
   "text": "Two quantities describe what a pump delivers: the flow rate Q, the volume of fluid moved per unit time, and the pressure rise \u0394p developed across the pump (equivalently, the head, when the pressure is expressed as a height of fluid column). The useful power imparted to the fluid, called the hydraulic power, is the product of the two: P_hydraulic = Q \u00d7 \u0394p. For example, a pump delivering 90 litres per second (0.09 cubic metres per second) against a pressure rise of 180 kilopascals imparts 0.09 \u00d7 180,000 = 16,200 watts, or 16.2 kilowatts, of hydraulic power to the water. This is the useful output of the pump; the input required at the shaft is always larger, because no real pump is perfectly efficient.\n3. Efficiency and shaft power\nThe efficiency of a pump at a given operating point is the ratio of hydraulic power out to shaft power in: \u03b7 = P_hydraulic / P_shaft. Continuing the example, if the pump's efficiency at its operating point is 72 percent, the shaft power required is 16.2 / 0.72 = 22.5 kilowatts. If the driving motor is 93 percent efficient, the electrical input drawn from the supply is 22.5 / 0.93 = 24.2 kilowatts. The product of pump and motor efficiencies is sometimes called the wire-to-water efficiency; here it is 16.2 / 24.2, about 67 percent. Efficiency is not a fixed property of a pump: it peaks at one flow, the best efficiency point, and falls off on either side, which is why matching the pump to the duty it actually serves matters.\n4. The affinity laws"
  },
  {
   "page": 3,
   "text": "For a given pump, changing the rotational speed changes the operating point in a predictable way. At corresponding points on the pump's characteristic \u2014 points related by the speed change \u2014 the affinity laws state that flow varies in direct proportion to speed (Q \u221d N), pressure or head varies with the square of speed (\u0394p \u221d N\u00b2), and shaft power varies with the cube of speed (P \u221d N\u00b3). The efficiency at corresponding points is approximately unchanged. These three proportionalities are the basis of energy saving by speed control: because power falls with the cube of speed, a modest reduction in speed produces a disproportionately large reduction in power.\n5. Worked example: slowing a pump down\nTake the pump of Sections 2 and 3, running at full speed with Q = 90 L/s, \u0394p = 180 kPa and shaft power 22.5 kW, and reduce its speed to 85 percent of full speed using a variable-speed drive. The affinity laws give: flow Q\u2082 = 0.85 \u00d7 90 = 76.5 L/s; pressure \u0394p\u2082 = 0.85\u00b2 \u00d7 180 = 0.7225 \u00d7 180 = 130.05 kPa; shaft power P\u2082 = 0.85\u00b3 \u00d7 22.5 = 0.614 \u00d7 22.5 = 13.8 kW. The ideal shaft-power saving is therefore 22.5 \u2212 13.8 = 8.7 kW, or about 38.6 percent, in exchange for a 15 percent reduction in flow. Two cautions apply. First, the 38.6 percent figure is an ideal shaft-power saving at corresponding points; the saving in metered electrical energy will be smaller once drive losses and the motor's part-load efficiency are counted. Second, the cube law describes the pump, not the system: where a system has substantial static head (for example, lifting water to a roof tank), the flow falls faster than the affinity laws suggest as speed is reduced, and below some speed the pump cannot overcome the static head at all."
  },
  {
   "page": 4,
   "text": "6. Operating point and control\nA pump does not choose its own flow. The operating point is set by the intersection of the pump's pressure-versus-flow curve with the system resistance curve, which describes how much pressure the pipework, fittings and coils absorb at each flow. Traditionally, excess pressure was burned off by throttling a valve, which moves the operating point along the pump curve and wastes energy across the valve. Varying the speed instead shifts the pump curve itself, so the required flow is produced at close to the required pressure. Good practice also includes keeping the operating point near the best efficiency point, maintaining adequate net positive suction head so the pump does not cavitate, and checking periodically that the duty has not drifted from the duty the pump was selected for."
  }
 ],
 "labs": {
  "note": "The four validated Visual Lab components from Atlas v2 (concept-comparison.md \u00a711). Deterministic computation only \u2014 no AI at runtime. Each lab: prediction gate first (controls locked until a prediction is committed), parameter schema with range rejection (never silently clamp), live readouts + chart, misconception check panel, assumptions and a hand-checked reference example.",
  "affinityLaws": {
   "title": "Affinity Laws Lab \u2014 pumps",
   "schema": "Pump speed 50\u2013110% of rated",
   "baseline": {
    "flow_Ls": 120,
    "pressure_kPa": 250,
    "efficiency": 0.75,
    "hydraulic_kW": 30.0,
    "shaft_kW": 40.0
   },
   "baselineNote": "PHYSICALLY COHERENT CORRECTED BASELINE (owner-directed audit, 24 Nov 2026): hydraulic power = Q \u00d7 \u0394p = 0.120 m\u00b3/s \u00d7 250 kPa = 30.0 kW; shaft power = 30.0 / 0.75 = 40.0 kW at the assumed 75% efficiency. Do NOT use the superseded 1,000 Pa / 8.0 kW set in this lab \u2014 that set implied 1.5% efficiency.",
   "referenceAt80": {
    "flow_Ls": 96.0,
    "pressure_kPa": 160,
    "hydraulic_kW": 15.36,
    "shaft_kW": 20.48,
    "savingPct": 48.8
   },
   "predictionOptions_kW": {
    "correct": 20.48,
    "linearTrap": 32.0,
    "squareTrap": 25.6
   },
   "assumptions": "Same pump, same system, incompressible flow, efficiency constant at 75% across the speed range, no motor/drive losses \u2014 an ideal estimate, not a meter or bill result.",
   "citation": "Motor Driven Systems manual \u00b7 Chapter 5 \u2014 Pumping Systems"
  },
  "derivativeTangent": {
   "title": "Derivative & Tangent Explorer",
   "schema": "Point of tangency \u22123 to 3; functions f(x)=x\u00b2, f(x)=x\u00b3, f(x)=sin x",
   "reference": "For f(x)=x\u00b2 at x=2: gradient f\u2032(2)=4; tangent line y = 4x \u2212 4."
  },
  "ohmsLaw": {
   "title": "Ohm's Law Explorer",
   "schema": "Voltage 0\u201324 V; resistance 1\u2013100 \u03a9",
   "reference": "At V=12 V, R=6 \u03a9: I = V/R = 2 A; power P = V \u00d7 I = 24 W."
  },
  "phaseDiagram": {
   "title": "Phase Diagram Explorer (water, idealised teaching diagram)",
   "schema": "Temperature \u221210 to 120 \u00b0C; pressure 0.1 to 5 atm",
   "reference": "At 25 \u00b0C and 1 atm water is liquid. Triple point 0.01 \u00b0C at 0.006 atm (below this lab's pressure range \u2014 shown for reference). At 1 atm, ice melts at 0 \u00b0C and water boils at 100 \u00b0C."
  }
 }
};
