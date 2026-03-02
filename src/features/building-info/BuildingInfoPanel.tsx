type Props = {
  selectedFloor: number | null
}

export default function BuildingInfoPanel({ selectedFloor }: Props) {
  return (
    <div
      style={{
        width: 300,
        padding: 20,
        background: "#111",
        color: "white",
      }}
    >
      {selectedFloor !== null ? (
        <>
          <h2>Этаж {selectedFloor}</h2>
          <p>Статус: Строится</p>
          <p>Прогресс: {selectedFloor * 20}%</p>
        </>
      ) : (
        <p>Выберите этаж</p>
      )}
    </div>
  )
}