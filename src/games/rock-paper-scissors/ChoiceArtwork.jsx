const ink = '#0a2417'
const cream = '#f2ffe0'
const lime = '#c8ff4d'
const shade = '#a3c580'

const gestures = {
  rock: <>
    <path d="M59 108h51v38H59z" fill={lime}/>
    <path d="M59 135h51v11H59z" fill="#719b50" stroke="none"/>
    <path d="M38 78V48h9v-9h18v-6h20v5h21v8h17v10h7v44h-8v14h-13v9H61v-9H48v-11H36V89h-7V78z" fill={cream}/>
    <path d="M48 103h13v11h48v-9h13V86h8v14h-8v14h-13v9H61v-9H48z" fill={shade} stroke="none"/>
    <path d="M60 42v28h21V39m1 8v25h22V48m1 11v17h22M40 73h15v9h30v13H61v13" fill="none"/>
    <path d="M46 51h8v12h-8zm21-9h8v15h-8zm22 5h8v13h-8zm22 12h8v8h-8z" fill="#fffef0" stroke="none"/>
    <path d="M68 132h10v7H68z" fill={cream} stroke="none"/>
  </>,
  paper: <>
    <path d="M58 117h52v29H58z" fill={lime}/>
    <path d="M58 136h52v10H58z" fill="#719b50" stroke="none"/>
    <path d="M43 82V37h7v-8h12v8h4V20h7v-7h12v7h4v-2h13v8h4v20h4V34h8v-7h11v8h5v49h-5v22h-9v13h-12v7H62v-7H47v-12H35V96H24V84h-7V72h7v-5h11v7h8z" fill={cream}/>
    <path d="M46 99h15v14h47v-7h12V94h9V84h5v22h-14v13h-12v7H62v-7H47v-12H35V96H24v-9h11v9h11z" fill={shade} stroke="none"/>
    <path d="M66 42v36m23-50v48m21-29v34M43 82l15 17m17-3h29" fill="none"/>
    <path d="M51 40h7v24h-7zm24-16h6v39h-6zm22 7h5v31h-5zm24 9h6v27h-6z" fill="#fffef0" stroke="none"/>
    <path d="M68 133h10v7H68z" fill={cream} stroke="none"/>
  </>,
  scissors: <>
    <path d="M59 117h51v29H59z" fill={lime}/>
    <path d="M59 136h51v10H59z" fill="#719b50" stroke="none"/>
    <path d="M52 78V67h8V51h-5V32h-5V21h7v-6h13v7h6v17h5v16h8V43h5V26h5V15h13v6h8v14h-5v20h-5v19h10v8h8v24h-9v13h-10v8H62v-7H49v-13H38V85h6v-7z" fill={cream}/>
    <path d="M49 105h13v14h47v-8h10v-13h9v8h-9v13h-10v8H62v-7H49v-13H38V96h11z" fill={shade} stroke="none"/>
    <path d="M52 78h15v9h30v12H70v13M99 78v9h24m-39 12v12m26-14v12" fill="none"/>
    <path d="M59 27h7v16h5v18h-7V46h-5zm44-1h6v15h-5v19h-6V43h5z" fill="#fffef0" stroke="none"/>
    <path d="M68 133h10v7H68z" fill={cream} stroke="none"/>
  </>,
  unknown: <>
    <path d="M59 117h51v29H59z" fill="#365b35"/>
    <path d="M38 78V48h9v-9h18v-6h20v5h21v8h17v10h7v44h-8v14h-13v9H61v-9H48v-11H36V89h-7V78z" fill="#2d5131"/>
    <path d="M48 103h13v11h48v-9h13V86h8v14h-8v14h-13v9H61v-9H48z" fill="#1c3c26" stroke="none"/>
    <path d="M68 57v-7h21v7h7v14h-7v7h-7v9H71V72h7v-7h7v-6H78v6H68zm3 37h11v11H71z" fill={lime} stroke="none"/>
    <path d="M68 133h10v7H68z" fill={lime} stroke="none"/>
  </>,
}

/** Hand-drawn pixel silhouettes shared by the duel stage and choice controls. */
export default function ChoiceArtwork({ choice = 'unknown', size = 160, className = '', ...props }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 160 160" fill="none" stroke={ink} strokeWidth="5" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true" focusable="false" {...props}>
    {gestures[choice] || gestures.unknown}
  </svg>
}
