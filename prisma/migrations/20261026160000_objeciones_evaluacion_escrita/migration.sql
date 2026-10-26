-- Conserva el catálogo y los resultados históricos. La introducción ya no emite un sello:
-- la nueva actividad SIMULATOR requiere una evaluación escrita aprobada.
DO $$
DECLARE m uuid; a uuid;
BEGIN
  SELECT id INTO m FROM induccion.modulos_formacion WHERE slug = 'simulador-cobranzas';
  IF m IS NULL THEN RETURN; END IF;
  UPDATE induccion.actividades SET title = 'Objeciones: introducción a los cinco casos', updated_at = now()
  WHERE module_id = m AND "order" = 1 AND type = 'LESSON';
  INSERT INTO induccion.actividades (module_id, type, "order", status, title, is_required, route, updated_at)
  VALUES (m, 'SIMULATOR', 2, 'ACTIVE', 'Objeciones: evaluación escrita de cinco casos', true, '/induccion/modulos/simulador-cobranzas', now())
  ON CONFLICT (module_id, "order") DO NOTHING;
  SELECT id INTO a FROM induccion.actividades WHERE module_id = m AND "order" = 2;
  INSERT INTO induccion.evaluaciones (activity_id, version, title, minimum_score, max_attempts, wait_minutes, content_version, status)
  SELECT a, 1, 'Objeciones: evaluación escrita de cinco casos', 80, 1, 0, 1, 'ACTIVE'
  WHERE NOT EXISTS (SELECT 1 FROM induccion.evaluaciones WHERE activity_id = a);
  -- Equivalencia explícita para quienes ya completaron el módulo antes de esta evaluación.
  -- No inventa notas ni intentos; conserva su sello y les permite practicar en modo repaso.
  INSERT INTO induccion.progreso_actividad (user_id, activity_id, status, completed_at, last_activity_at, updated_at)
  SELECT u.user_id, a, 'PASSED', u.finished, u.finished, now() FROM (
    SELECT user_id, max(finished) AS finished FROM (
      SELECT user_id, issued_at AS finished FROM induccion.sellos WHERE module_id = m AND status = 'ACTIVE'
      UNION ALL SELECT user_id, completed_at AS finished FROM induccion.progreso_modulo WHERE module_id = m AND status = 'PASSED'
    ) old GROUP BY user_id
  ) u ON CONFLICT (user_id, activity_id) DO NOTHING;
  -- La nueva introducción conserva los bloques antiguos como historial, con versión distinta.
  UPDATE induccion.progreso_modulo SET percent = 0, updated_at = now()
  WHERE module_id = m AND status <> 'PASSED' AND NOT EXISTS (
    SELECT 1 FROM induccion.sellos s WHERE s.user_id = progreso_modulo.user_id AND s.module_id = m AND s.status = 'ACTIVE'
  );
END $$;
