import { useQuery } from "@tanstack/react-query";
import { MapPin, Search } from "lucide-react";
import { useDeferredValue, useId, useState } from "react";

import { type Airport, searchAirports } from "../api/client";

const referenceAirports: Airport[] = [
  {
    icao_code: "LEMD",
    iata_code: "MAD",
    name: "Adolfo Suárez Madrid-Barajas",
    municipality: "Madrid",
    iso_country: "ES",
    latitude_deg: 40.47,
    longitude_deg: -3.56,
  },
  {
    icao_code: "KJFK",
    iata_code: "JFK",
    name: "John F Kennedy International",
    municipality: "New York",
    iso_country: "US",
    latitude_deg: 40.64,
    longitude_deg: -73.78,
  },
];

export function AirportCombobox({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const deferredQuery = useDeferredValue(value.trim());
  const query = useQuery({
    queryKey: ["airports", deferredQuery],
    queryFn: () => searchAirports(deferredQuery),
    enabled: deferredQuery.length >= 2 && open,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const localMatches = referenceAirports.filter((airport) =>
    airportSearchText(airport).includes(deferredQuery.toLowerCase())
  );
  const airports = query.data?.length ? query.data : localMatches;
  const listboxId = `${id}-options`;

  return (
    <label className="field airport-combobox">
      <span>{label}</span>
      <span className="airport-combobox__control">
        <Search aria-hidden="true" size={15} />
        <input
          aria-autocomplete="list"
          aria-controls={open ? listboxId : undefined}
          aria-expanded={open}
          autoComplete="off"
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          role="combobox"
          value={value}
        />
      </span>
      {open && deferredQuery.length >= 2 ? (
        <ul className="airport-options" id={listboxId} role="listbox">
          {airports.map((airport) => (
            <li key={airport.icao_code} role="option" aria-selected="false">
              <button
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(formatAirport(airport));
                  setOpen(false);
                }}
                type="button"
              >
                <MapPin aria-hidden="true" size={16} />
                <span>
                  <strong>
                    {airport.iata_code ?? airport.icao_code} ·{" "}
                    {airport.icao_code}
                  </strong>
                  <small>
                    {airport.name}
                    {airport.municipality ? `, ${airport.municipality}` : ""}
                  </small>
                </span>
              </button>
            </li>
          ))}
          {!airports.length && !query.isLoading ? (
            <li className="airport-options__empty">No airports found</li>
          ) : null}
          {query.isLoading ? (
            <li className="airport-options__empty">Searching catalogue…</li>
          ) : null}
        </ul>
      ) : null}
    </label>
  );
}

function airportSearchText(airport: Airport) {
  return [
    airport.icao_code,
    airport.iata_code,
    airport.name,
    airport.municipality,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatAirport(airport: Airport) {
  return `${airport.iata_code ?? airport.icao_code} · ${airport.icao_code} — ${airport.name}`;
}
