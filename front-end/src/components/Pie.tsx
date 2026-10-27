import { useNegocio } from '../lib/negocio'

/* FOOTER (Figma 20:83) — se repite en todas las pantallas */
export default function Pie() {
  const { logo, nombre } = useNegocio()
  return (
    <footer className="relative flex h-[110px] flex-none items-center justify-center bg-tinto max-[760px]:h-auto max-[760px]:flex-col max-[760px]:gap-1.5 max-[760px]:px-4 max-[760px]:py-5">
      <img
        className="absolute top-1/2 left-[1.61%] w-[140px] -translate-y-1/2 max-[760px]:static max-[760px]:w-[100px] max-[760px]:translate-y-0"
        src={logo}
        width={218}
        height={106}
        alt={nombre}
      />
      <p className="text-center font-titulo text-[22px] leading-[1.4] font-semibold whitespace-pre-wrap text-white [font-variant-caps:all-small-caps] max-[760px]:text-lg">
        © {new Date().getFullYear()} {nombre.toUpperCase()}&nbsp; Todos los Derechos Reservados.
      </p>
    </footer>
  )
}
