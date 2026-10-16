CREATE TABLE vehicle_rejections (
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload)),
  PRIMARY KEY (vehicle_id, position)
);

WITH phrases AS (
  SELECT vehicles.id AS vehicle_id, vehicles.distance_km AS distance_km, reason.key AS position, reason.value AS phrase
  FROM vehicles, json_each(NULLIF(vehicles.reasons, '')) AS reason
  WHERE reason.type = 'text'
),
classified AS (
  SELECT vehicle_id, distance_km, position, phrase,
    CASE
      WHEN phrase LIKE 'marque non reconnue' THEN 'unknownBrand'
      WHEN phrase LIKE 'marque _% désactivée' THEN 'disabledBrand'
      WHEN phrase LIKE 'marque %' THEN 'unfollowedBrand'
      WHEN phrase LIKE 'ni supercar%' THEN 'notSpecial'
      WHEN phrase LIKE 'vendeur professionnel%' THEN 'professionalSeller'
      WHEN phrase LIKE '%hors du rayon%' THEN 'outsideRadius'
      WHEN phrase LIKE '%au-dessus de % km%' THEN 'mileageAbove'
      ELSE 'unrecognizedPhrase'
    END AS kind
  FROM phrases
),
sliced AS (
  SELECT vehicle_id, distance_km, position, phrase, kind,
    CASE
      WHEN kind = 'disabledBrand'
        THEN substr(phrase, length('marque ') + 1, length(phrase) - length('marque ') - length(' désactivée'))
      WHEN kind = 'unfollowedBrand' AND phrase LIKE 'marque _% hors des familles suivies'
        THEN substr(phrase, length('marque ') + 1, length(phrase) - length('marque ') - length(' hors des familles suivies'))
      WHEN kind = 'unfollowedBrand'
        THEN substr(phrase, length('marque ') + 1)
    END AS make,
    CASE kind
      WHEN 'mileageAbove' THEN substr(phrase, 1, instr(phrase, 'au-dessus de') - 1)
      WHEN 'outsideRadius' THEN substr(phrase, 1, instr(phrase, 'hors du rayon de') - 1)
    END AS first_written,
    CASE kind
      WHEN 'mileageAbove' THEN substr(phrase, instr(phrase, 'au-dessus de') + length('au-dessus de'))
      WHEN 'outsideRadius' THEN substr(phrase, instr(phrase, 'hors du rayon de') + length('hors du rayon de'))
    END AS second_written
  FROM classified
),
measured AS (
  SELECT vehicle_id, distance_km, position, phrase, kind, make,
    CAST(replace(trim(first_written, ' àkm,'), ' ', '') AS INTEGER) AS first_number,
    CAST(replace(trim(second_written, ' àkm,'), ' ', '') AS INTEGER) AS second_number
  FROM sliced
)
INSERT INTO vehicle_rejections (vehicle_id, position, kind, payload)
SELECT vehicle_id, position, kind,
  CASE kind
    WHEN 'unfollowedBrand' THEN json_object('make', make)
    WHEN 'disabledBrand' THEN json_object('make', make)
    WHEN 'mileageAbove' THEN json_object('km', first_number, 'maxKm', second_number)
    WHEN 'outsideRadius' THEN json_object(
      'distanceKm', CASE WHEN round(distance_km) = first_number THEN distance_km ELSE first_number END,
      'radiusKm', second_number
    )
    WHEN 'unrecognizedPhrase' THEN json_object('phrase', phrase)
    ELSE json_object()
  END
FROM measured
ORDER BY vehicle_id, position;

ALTER TABLE vehicles DROP COLUMN reasons;
