-- Migração para garantir que aprovações e recusas de folga notifiquem todos os envolvidos do nível,
-- incluindo quem aprovou/decidiu, quem solicitou, chefe de categoria e gerente de unidade correspondentes, e admins/RH.

CREATE OR REPLACE FUNCTION notify_leave_update()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_name TEXT;
    v_employee_id UUID;
    v_category_id UUID;
    v_unit_id UUID;
    v_status_text TEXT;
    v_title TEXT;
    v_message TEXT;
    v_link TEXT;
    v_decided_by_name TEXT;
    v_target RECORD;
BEGIN
    -- Só age em transições de status (aprovação ou recusa)
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Obter dados do profissional vinculado à folga
    SELECT p.name, p.id, p.category_id, p.unit_id 
    INTO v_employee_name, v_employee_id, v_category_id, v_unit_id
    FROM employees p
    WHERE p.id = NEW.employee_id;

    -- Se o profissional não existir ou foi removido, não dispara notificações
    IF v_employee_name IS NULL THEN
        RETURN NEW;
    END IF;

    -- Nome de quem tomou a decisão
    IF NEW.decided_by IS NOT NULL THEN
        SELECT COALESCE(display_name, email, 'Gestor')
        INTO v_decided_by_name
        FROM profiles
        WHERE id = NEW.decided_by;
    END IF;

    v_decided_by_name := COALESCE(v_decided_by_name, 'Gestão');

    IF NEW.status = 'approved' THEN
        v_status_text := 'Aprovada';
        v_title := 'Folga Aprovada';
        v_message := 'A solicitação de folga para ' || v_employee_name || ' foi aprovada por ' || v_decided_by_name || '.';
    ELSIF NEW.status = 'rejected' THEN
        v_status_text := 'Recusada';
        v_title := 'Folga Recusada';
        v_message := 'A solicitação de folga para ' || v_employee_name || ' foi recusada por ' || v_decided_by_name || '.';
        IF NEW.rejection_reason IS NOT NULL AND TRIM(NEW.rejection_reason) <> '' THEN
            v_message := v_message || ' Motivo: ' || NEW.rejection_reason;
        END IF;
    ELSE
        -- Outro status intermediário
        RETURN NEW;
    END IF;

    v_link := '/folgas';

    -- Notificar todos os perfis relevantes dentro do escopo:
    -- 1. Admins e RH
    -- 2. Chefe de categoria correspondente à categoria do profissional
    -- 3. Gerente de unidade correspondente à unidade do profissional
    -- 4. O solicitante original da folga
    -- 5. O decisor da folga (para confirmação imediata em suas notificações)
    FOR v_target IN
        SELECT DISTINCT u.id AS user_id
        FROM profiles u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        WHERE 
            ur.role IN ('admin', 'rh')
            OR (ur.role = 'category_chief' AND ur.category_id IS NOT NULL AND ur.category_id = v_category_id)
            OR (ur.role = 'unit_manager' AND ur.unit_id IS NOT NULL AND ur.unit_id = v_unit_id)
            OR u.id = NEW.requested_by
            OR u.id = NEW.decided_by
    LOOP
        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            link,
            created_at
        ) VALUES (
            v_target.user_id,
            v_title,
            v_message,
            'leave_status',
            v_link,
            NOW()
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
