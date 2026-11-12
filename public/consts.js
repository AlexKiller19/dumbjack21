// Constantes compartidas: tamaño del lienzo, asientos, zapato de cartas y paleta.
export const W = 480, H = 256;

// Asientos: x = centro, cy = arriba de las cartas, ay = arriba del avatar.
// SEATS (2-4 jugadores): placa a la derecha del personaje. SEATS6 (5-6): más juntos, placa debajo.
export const SEATS6 = [
  { x: 60, cy: 128, ay: 170 }, { x: 130, cy: 150, ay: 194 }, { x: 204, cy: 162, ay: 208 },
  { x: 276, cy: 162, ay: 208 }, { x: 350, cy: 150, ay: 194 }, { x: 420, cy: 128, ay: 170 },
];
export const SEATS = [{ x: 88, cy: 146, ay: 186 }, { x: 192, cy: 170, ay: 212 }, { x: 288, cy: 170, ay: 212 }, { x: 392, cy: 146, ay: 186 }];

export const CARD_W = 16, CARD_H = 22;

export const SHOE = { x: 322, y: 114 };

export const DEALER_Y = 120;

export const C = {
  wallA: '#6b4226', wallB: '#5d381f', wallC: '#7d4f2d', dark: '#2a160c', beam: '#3d2212',
  felt: '#1f6e47', feltD: '#185a3a', feltL: '#2d8a5a', rim: '#5b3216', rimL: '#8f5a2c', rimD: '#3a1f0d',
  gold: '#f2c14e', cream: '#f4ecd8', red: '#d6403a', black: '#1a1014', white: '#fff8e8',
  skin: ['#f0c39a', '#d99a6c', '#c48a5c', '#a86b45'],
};
