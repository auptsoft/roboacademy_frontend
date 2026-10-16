import type { InteractiveLessonContent } from '@roboacademy/ui'

// Fixture for the dev preview page (/app/dev/interactive-lesson) until the backend serves
// lesson content blocks.
export const sampleInteractiveLesson: InteractiveLessonContent = {
  version: 1,
  blocks: [
    {
      id: 'intro',
      type: 'text',
      body: 'An LED is a **diode**: current only flows one way through it. Connect it backwards and it simply stays dark. Without a resistor in series, it draws too much current and burns out.',
    },
    {
      id: 'parts',
      type: 'reveal',
      prompt: 'Tap each part of the circuit to see what it does.',
      items: [
        { id: 'anode', label: 'Anode (long leg)', body: 'The **positive** side. Connect it towards the Arduino pin.' },
        { id: 'cathode', label: 'Cathode (short leg)', body: 'The **negative** side, often next to a flat edge on the LED. Connect it towards GND.' },
        { id: 'resistor', label: '220 Ω resistor', body: 'Limits the current to about 15 mA so neither the LED nor the pin is damaged.' },
        { id: 'pin', label: 'Digital pin 13', body: 'Outputs 5 V when set `HIGH` and 0 V when set `LOW`.' },
      ],
    },
    {
      id: 'q-resistor',
      type: 'choice',
      prompt: 'Why does the LED need a resistor?',
      options: [
        { id: 'a', text: 'To make the LED brighter', feedback: 'The opposite: the resistor reduces current, so it can only make the LED dimmer.' },
        { id: 'b', text: 'To limit the current through the LED', correct: true },
        { id: 'c', text: 'To change the LED\'s colour', feedback: 'Colour is set by the LED\'s material, not the circuit around it.' },
      ],
      explanation: 'An LED barely resists current once it turns on. The resistor sets the current: (5 V − 2 V) ÷ 220 Ω ≈ 14 mA.',
    },
    {
      id: 'wiring-text',
      type: 'text',
      body: 'Now wire it up. The order matters: build the circuit with the board **unplugged**, then upload the sketch.',
    },
    {
      id: 'q-order',
      type: 'order',
      prompt: 'Put the steps in the right order.',
      items: [
        { id: 'unplug', text: 'Unplug the Arduino from USB' },
        { id: 'resistor', text: 'Connect pin 13 to the resistor' },
        { id: 'led', text: 'Connect the resistor to the LED\'s long leg' },
        { id: 'gnd', text: 'Connect the LED\'s short leg to GND' },
        { id: 'upload', text: 'Plug in and upload the Blink sketch' },
      ],
      explanation: 'Always wire with the power off, and follow the current: pin → resistor → LED → ground.',
    },
    {
      id: 'q-bonus',
      type: 'choice',
      required: false,
      prompt: 'Bonus: the LED doesn\'t light up. What should you check first?',
      options: [
        { id: 'a', text: 'Whether the LED is in backwards', correct: true, feedback: 'Yes. A reversed LED is the most common cause.' },
        { id: 'b', text: 'Whether the Arduino is broken', feedback: 'Possible, but unlikely. Check the simple things first.' },
      ],
    },
    {
      id: 'wrap',
      type: 'text',
      body: 'Nice work. Next lesson: make the LED fade with `analogWrite()`.',
    },
  ],
}
