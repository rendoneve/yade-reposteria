import logoFooter from '../assets/img/logo-yade-footer.png'

/* FOOTER (Figma 20:83) — se repite en todas las pantallas */
export default function Pie() {
  return (
    <footer className="pie">
      <img className="pie__logo" src={logoFooter} width={218} height={106} alt="Yade" />
      <p className="pie__texto">© {new Date().getFullYear()} YADE BAKERY&nbsp; Todos los Derechos Reservados.</p>
    </footer>
  )
}
