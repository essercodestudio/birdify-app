import React from 'react';

const GolfPinIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 18v-15l7 4-7 4" />
    <path d="M9 17.67c-.62 .36 -1 .82 -1 1.33c0 .97 .9 1.5 2 1.5s2 -.53 2 -1.5c0 -.5 -.38 -.97 -1 -1.33" />
  </svg>
);

export default GolfPinIcon;