/* Texto de los títulos (hero) con grosor por fragmento. El administrador lo escribe en
   Configuración con botones; internamente cada fragmento queda como {PESO|texto},
   por ejemplo {500|Postres} que hacen {700|la vida} más dulce. Sin marcas se ve normal. */
const MARCA = /\{([1-9]00)\|([^{}]*)\}/g

export default function TextoRico({ texto }: { texto: string }) {
  const partes: (string | React.JSX.Element)[] = []
  let ultimo = 0
  for (const m of texto.matchAll(MARCA)) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index))
    partes.push(<span key={m.index} style={{ fontWeight: Number(m[1]) }}>{m[2]}</span>)
    ultimo = m.index + m[0].length
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo))
  return <>{partes}</>
}
