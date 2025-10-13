import nodemailer from "nodemailer";
import crypto from "crypto";
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import multer from "multer";
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import bcrypt from "bcrypt";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, "__/uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage: storage });

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    connectionLimit: 10,
};

const pool = mysql.createPool(dbConfig);

// --- ROTAS PARA CAMPOS (COURSES) ---
app.get("/api/courses", async (req: Request, res: Response) => {
    let connection;
    try {
        const { adminId } = req.query;
        if (!adminId) {
            return res.status(400).json({ error: "Admin ID é obrigatório para buscar os campos." });
        }

        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            "SELECT * FROM courses WHERE adminId = ?",
            [adminId]
        );
        res.json(rows);
    } catch (error) {
        console.error("Error as a buscar canpos:", error);
        res.status(500).json({ error: "Error as a buscar canpos" });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA PARA CAMPOS PÚBLICOS (PARA CRIAÇÃO DE TREINO)
app.get("/api/courses/public", async (req: Request, res: Response) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(
      "SELECT id, name, location FROM courses ORDER BY name ASC"
    );
    
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar campos públicos:", error);
    res.status(500).json({ 
      error: "Erro ao buscar campos públicos",
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/api/courses", upload.array("holeImages"), async (req: Request, res: Response) => {
    let connection;
    try {
        const { name, location, adminId } = req.body;
        const holes = JSON.parse(req.body.holes);
        const files = req.files as Express.Multer.File[];
        const fileMap = new Map(files.map((f) => [f.originalname, f.filename]));

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [courseResult]: any = await connection.execute(
            "INSERT INTO courses (name, location, adminId) VALUES (?, ?, ?)",
            [name, location, adminId]
        );

        const newCourseId = courseResult.insertId;

        for (const holeData of holes) {
            const originalFileName = `hole_${holeData.holeNumber}`;
            const savedFileName = fileMap.get(originalFileName);
            const imageUrl = savedFileName ? `/uploads/${savedFileName}` : null;

            const [holeResult]: any = await connection.execute(
                "INSERT INTO holes (courseId, holeNumber, par, aerialImageUrl) VALUES (?, ?, ?, ?)",
                [newCourseId, holeData.holeNumber, holeData.par, imageUrl]
            );

            const newHoleId = holeResult.insertId;

            for (const teeColor in holeData.tees) {
                const yardage = holeData.tees[teeColor];
                if (yardage > 0) {
                    await connection.execute(
                        "INSERT INTO tees (holeId, color, yardage) VALUES (?, ?, ?)",
                        [newHoleId, teeColor, yardage]
                    );
                }
            }
        }

        await connection.commit();
        res.status(201).json({ id: newCourseId, name, location });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao criar campo completo:", error);
        res.status(500).json({ error: "Erro ao criar o campo no banco de dados" });
    } finally {
        if (connection) connection.release();
    }
});

app.delete("/api/courses/:id", async (req: Request, res: Response) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        await connection.execute("DELETE FROM courses WHERE id = ?", [id]);
        res.status(200).json({ message: "Campo apagado com sucesso." });
    } catch (error) {
        console.error("Erro ao apagar campo:", error);
        if ((error as any).code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(400).json({
                error: "Não pode apagar este campo, pois ele está a ser usado por um ou mais torneios.",
            });
        }
        res.status(500).json({ error: "Erro ao apagar campo." });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/courses/:id/details", async (req: Request, res: Response) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [courseRows]: any[] = await connection.execute(
            "SELECT * FROM courses WHERE id = ?",
            [id]
        );
        if (courseRows.length === 0) {
            return res.status(404).json({ error: "Campo não encontrado." });
        }
        const course = courseRows[0];
        const [holes]: any[] = await connection.execute(
            "SELECT * FROM holes WHERE courseId = ? ORDER BY holeNumber ASC",
            [id]
        );
        for (const hole of holes) {
            const [tees] = await connection.execute(
                "SELECT * FROM tees WHERE holeId = ?",
                [hole.id]
            );
            hole.tees = tees;
        }
        course.holes = holes;
        res.json(course);
    } catch (error) {
        console.error("Error as buscar detalhes completes do campo:", error);
        res.status(500).json({ error: "Error as buscar detalhes do campo" });
    } finally {
        if (connection) connection.release();
    }
});

app.put("/api/courses/:id/details", async (req: Request, res: Response) => {
    let connection;
    try {
        const { id } = req.params;
        const { name, location, holes } = req.body;
        connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.execute(
            "UPDATE courses SET name = ?, location = ? WHERE id = ?",
            [name, location, id]
        );
        for (const holeData of holes) {
            await connection.execute(
                "UPDATE holes SET par = ? WHERE id = ? AND courseId = ?",
                [holeData.par, holeData.id, id]
            );
            for (const teeData of holeData.tees) {
                await connection.execute(
                    "UPDATE tees SET yardage = ? WHERE id = ? AND holeId = ?",
                    [teeData.yardage, teeData.id, holeData.id]
                );
            }
        }
        await connection.commit();
        res.status(200).json({ message: "Campo atualizado com sucesso." });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar campo:", error);
        res.status(500).json({ error: "Erro ao atualizar o campo." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTAS DE TORNEIOS E INSCRIÇÕES ---
app.post("/api/tournaments", async (req: Request, res: Response) => {
    let connection;
    try {
        const { name, date, courseId, startTime, adminId, categories } = req.body;
        if (!name || !date || !courseId || !adminId) {
            return res.status(400).json({ error: "Nome, data, campo e adminId são obrigatórios." });
        }
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const query = "INSERT INTO tournaments (name, date, courseId, startTime, adminId) VALUES (?, ?, ?, ?, ?)";
        const [result]: any = await connection.execute(query, [name, date, courseId, startTime || null, adminId]);
        const newTournamentId = result.insertId;
        if (categories && Array.isArray(categories) && categories.length > 0) {
            const categoryQuery = "INSERT INTO tournament_categories (tournamentId, name) VALUES ?";
            const categoryValues = categories.map((catName: string) => [newTournamentId, catName]);
            await connection.query(categoryQuery, [categoryValues]);
        }
        await connection.commit();
        res.status(201).json({ id: newTournamentId, ...req.body });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error ao criar torneio:", error);
        res.status(500).json({ error: "Error ao criar torneio" });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments", async (req: Request, res: Response) => {
    let connection;
    try {
        const { adminId } = req.query;
        if (!adminId) {
            return res.status(400).json({ error: "Admin ID é obrigatório para listar os torneios." });
        }
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            "SELECT * FROM tournaments WHERE adminId = ? ORDER BY date DESC",
            [adminId]
        );
        res.json(rows);
    } catch (error) {
        console.error("Erro ao buscar torneios:", error);
        res.status(500).json({ error: "Erro ao buscar torneios" });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments/:tournamentId/public", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows]: any[] = await connection.execute(
            `SELECT t.name, t.date, t.bannerImageUrl, t.paymentInstructions, c.name as courseName
             FROM tournaments t
             JOIN courses c ON t.courseId = c.id
             WHERE t.id = ?`,
            [tournamentId]
        );
        if (rows.length == 0) {
            return res.status(404).json({ error: "Torneio não encontrado." });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error("Erro ao buscar detalhes públicos do torneio:", error);
        res.status(500).json({ error: "Erro ao buscar detalhes do torneio." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTA CORRIGIDA PARA BUSCAR INSCRIÇÕES ---
app.get("/api/tournaments/:tournamentId/registrations", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    let connection;
    
    try {
        connection = await pool.getConnection();
        
        const query = `
            SELECT 
                tr.id,
                tr.playerId as player_id,
                tr.tournamentId as tournament_id, 
                tr.paymentStatus as payment_status,
                tr.registrationDate as registration_date,
                p.fullName,
                p.email
            FROM tournament_registrations tr
            INNER JOIN players p ON tr.playerId = p.id
            WHERE tr.tournamentId = ?
            ORDER BY tr.registrationDate DESC
        `;
        
        const [rows] = await connection.execute(query, [tournamentId]);
        
        const formattedRegistrations = (rows as any[]).map(row => ({
            id: row.id,
            player_id: row.player_id,
            tournament_id: row.tournament_id,
            payment_status: row.payment_status,
            registration_date: row.registration_date,
            player: {
                fullName: row.fullName,
                email: row.email
                // Removido phone pois não existe na tabela
            }
        }));
        
        res.json(formattedRegistrations);
        
    } catch (error: any) {
        console.error('Erro ao buscar inscrições:', error);
        res.status(500).json({ error: 'Erro ao buscar inscritos.' });
    } finally {
        if (connection) connection.release();
    }
});
// --- ROTA CORRIGIDA PARA ALTERNAR STATUS DE PAGAMENTO ---
app.patch("/api/registrations/:registrationId/status", async (req: Request, res: Response) => {
    let connection;
    try {
        const { registrationId } = req.params;
        const { status } = req.body;
        
        connection = await pool.getConnection();
        await connection.execute(
            "UPDATE tournament_registrations SET paymentStatus = ? WHERE id = ?",
            [status, registrationId]
        );
        
        res.status(200).json({ message: "Status atualizado!", newStatus: status });
    } catch (error) {
        console.error("Erro ao atualizar pagamento:", error);
        res.status(500).json({ error: "Erro ao atualizar." });
    } finally {
        if (connection) connection.release();
    }
});

app.patch("/api/registrations/:registrationId/confirm", async (req: Request, res: Response) => {
    let connection;
    try {
        const { registrationId } = req.params;
        connection = await pool.getConnection();
        await connection.execute(
            "UPDATE tournament_registrations SET paymentStatus = 'confirmed' WHERE id = ?",
            [registrationId]
        );
        res.status(200).json({ message: "Pagamento confirmado com sucesso." });
    } catch (error) {
        console.error("Erro ao confirmar pagamento:", error);
        res.status(500).json({ error: "Erro ao confirmar pagamento." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTA DE INSCRIÇÃO (VERSÃO FINAL) ---
app.post("/api/tournaments/:tournamentId/register", async (req: Request, res: Response) => {
    console.log("No Nova inscrição - Torneio:", req.params.tournamentId, "Jogador:", req.body.playerId);
    const { tournamentId } = req.params;
    const { playerId, answers } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        // VERIFICAR SE JÁ ESTÁ INSCRITO
        const [existing]: any = await connection.execute(
            "SELECT id FROM tournament_registrations WHERE playerId = ? AND tournamentId = ?",
            [playerId, tournamentId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: "Você já está inscrito neste torneio." });
        }
        // FAZER INSCRIÇÃO
        const [result]: any = await connection.execute(
            "INSERT INTO tournament_registrations (playerId, tournamentId, paymentStatus) VALUES (?, ?, 'pending')",
            [playerId, tournamentId]
        );
        const registrationId = result.insertId;
        console.log("</ Inscrição criada, ID:", registrationId);
        // SALVAR RESPOSTAS
        if (answers && Array.isArray(answers) && answers.length > 0) {
            console.log(`📖 Salvando ${answers.length} resposta(s)`);
            for (const answer of answers) {
                if (answer.questionId && answer.answerText) {
                    await connection.execute(
                        "INSERT INTO registration_answers (registrationId, questionId, answer) VALUES (?, ?, ?)",
                        [registrationId, answer.questionId, answer.answerText]
                    );
                    console.log(`</ª Resposta salva: questionId=${answer.questionId}, resposta="${answer.answerText}"`);
                }
            }
            console.log("</ª Todas as respostas salvas");
        }
        console.log("⬇ INSCRICÃO CONCLUÍDA COM SUCESSO!");
        res.status(201).json({  
            success: true,  
            message: "Inscrição realizada com sucesso!",  
            registrationId: registrationId  
        });
    } catch (error: any) {  
        console.error("⬇ ERRO:", error.message);  
        res.status(500).json({ error: "Erro interno ao realizar a inscrição." });
    } finally {  
        if (connection) connection.release();  
    }  
});

// --- ROTA DE EXPORTAÇÃO EXCEL CORRIGIDA ---
app.get("/api/tournaments/:tournamentId/export-registrations", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();

        // ✅ QUERY CORRIGIDA - REMOVIDO p.phone
        const query = `
        SELECT
            tr.id as registration_id,
            p.fullName as player_name,
            p.email as player_email,
            tr.paymentStatus,
            tr.registrationDate,
            tq.questionText,
            ra.answer
        FROM tournament_registrations tr
        INNER JOIN players p ON tr.playerId = p.id
        LEFT JOIN registration_answers ra ON tr.id = ra.registrationId
        LEFT JOIN tournament_questions tq ON ra.questionId = tq.id
        WHERE tr.tournamentId = ?
        ORDER BY tr.registrationDate DESC, p.fullName
        `;

        const [rows] = await connection.execute(query, [tournamentId]);
        const registrationsData = rows as any[];

        if (!registrationsData || registrationsData.length === 0) {
            return res.status(404).json({ error: 'Nenhuma inscrição encontrada para este torneio' });
        }

        // Criar workbook Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Inscritos');

        // Agrupar dados por inscrição
        const registrationsMap = new Map();
        registrationsData.forEach((row: any) => {
            if (!registrationsMap.has(row.registration_id)) {
                registrationsMap.set(row.registration_id, {
                    player_name: row.player_name,
                    player_email: row.player_email,
                    // ✅ REMOVIDO player_phone
                    payment_status: row.paymentStatus,
                    registration_date: row.registrationDate,
                    questions: {}
                });
            }
            if (row.questionText) {
                registrationsMap.get(row.registration_id).questions[row.questionText] = row.answer;
            }
        });

        const registrations = Array.from(registrationsMap.values());

        // ✅ HEADERS CORRETOS - SEM "Telefone"
        const headers = ['Nome', 'Email', 'Status Pagamento', 'Data Inscrição'];

        // Extrair perguntas únicas
        const questionHeadersSet = new Set<string>();
        registrationsData.forEach((row: any) => {
            if (row.questionText) {
                questionHeadersSet.add(row.questionText);
            }
        });

        const questionHeaders = Array.from(questionHeadersSet);
        headers.push(...questionHeaders);
        worksheet.addRow(headers);

        // Adicionar dados
        registrations.forEach((reg: any) => {
            const row = [
                reg.player_name,
                reg.player_email,
                // ✅ REMOVIDO player_phone
                reg.payment_status,
                new Date(reg.registration_date).toLocaleDateString('pt-BR')
            ];
            
            questionHeaders.forEach((question: string) => {
                row.push(reg.questions[question] || "");
            });

            worksheet.addRow(row);
        });

        // Estilizar cabeçalho
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6E6FA' }
        };

        // Auto-ajustar largura das colunas
        worksheet.columns.forEach((column: any) => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell: any) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength;
        });

        // Configurar resposta
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=inscritos_torneio_${tournamentId}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error: unknown) {
        console.error('Erro na exportação:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        res.status(500).json({
            error: 'Erro interno do servidor ao exportar inscrições',
            details: errorMessage
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});
// ROTA PARA BUSCAR JOGADORES CONFIRMADOS PARA GRUPOS
app.get("/api/tournaments/:tournamentId/confirmed-players", async (req: Request, res: Response) => {
  const { tournamentId } = req.params;
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    const [players] = await connection.execute(
      `SELECT 
        p.id as player_id,
        p.fullName,
        p.email,
        p.gender,
        p.modality,
        tr.id as registration_id
      FROM tournament_registrations tr
      JOIN players p ON tr.playerId = p.id
      WHERE tr.tournamentId = ? AND tr.paymentStatus = 'confirmed'
      ORDER BY p.fullName ASC`,
      [tournamentId]
    );
    
    res.json(players);
  } catch (error) {
    console.error("Erro ao buscar jogadores confirmados:", error);
    res.status(500).json({ error: "Erro ao buscar jogadores confirmados" });
  } finally {
    if (connection) connection.release();
  }
});
// SUBSTITUA a rota atual de criar treino por ESTA VERSÃO CORRIGIDA:
app.post("/api/trainings", async (req: Request, res: Response) => {
  const { courseId, creatorId, date, startHole } = req.body;
  let connection;

  console.log("📝 Dados recebidos:", { courseId, creatorId, date, startHole });

  // Validação dos dados
  if (!courseId || !creatorId || !date || !startHole) {
    return res.status(400).json({ error: "Dados insuficientes para criar o treino." });
  }

  try {
    connection = await pool.getConnection();
    
    // PRIMEIRO: Verificar se o curso existe
    const [courseCheck]: any[] = await connection.execute(
      "SELECT id, name FROM courses WHERE id = ?",
      [courseId]
    );

    if (courseCheck.length === 0) {
      return res.status(404).json({ error: "Curso não encontrado." });
    }

    // SEGUNDO: Verificar se o criador existe
    const [playerCheck]: any[] = await connection.execute(
      "SELECT id, fullName FROM players WHERE id = ?",
      [creatorId]
    );

    if (playerCheck.length === 0) {
      return res.status(404).json({ error: "Jogador não encontrado." });
    }

    console.log(`✅ Validações passadas: Curso ${courseCheck[0].name}, Jogador ${playerCheck[0].fullName}`);

    await connection.beginTransaction();

    // 1. INSERIR NA TABELA trainings
    const [trainingResult]: any = await connection.execute(
      "INSERT INTO trainings (courseId, creatorId, date) VALUES (?, ?, ?)",
      [courseId, creatorId, date]
    );

    const trainingId = trainingResult.insertId;
    console.log(`✅ Training criado com ID: ${trainingId}`);

    // 2. GERAR CÓDIGO DE ACESSO
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log(`🔑 Access Code gerado: ${accessCode}`);

    // 3. INSERIR NA TABELA training_groups
    const [groupResult]: any = await connection.execute(
      "INSERT INTO training_groups (trainingId, startHole, accessCode) VALUES (?, ?, ?)",
      [trainingId, startHole, accessCode]
    );

    const trainingGroupId = groupResult.insertId;
    console.log(`✅ Training Group criado com ID: ${trainingGroupId}`);

    // 4. INSERIR NA TABELA training_participants (CORRIGIDO)
    const [participantResult]: any = await connection.execute(
      "INSERT INTO training_participants (trainingGroupId, playerId, isResponsible, invitationStatus) VALUES (?, ?, ?, ?)",
      [trainingGroupId, creatorId, 1, 'accepted'] // Use 1 para true
    );

    console.log(`✅ Participante adicionado com ID: ${participantResult.insertId}`);

    await connection.commit();
    
    console.log(`🎉 Treino criado com sucesso! TrainingID: ${trainingId}, GroupID: ${trainingGroupId}, AccessCode: ${accessCode}`);
    
    res.status(201).json({
      message: "Treino criado com sucesso!",
      trainingId,
      trainingGroupId,
      accessCode
    });

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error("❌ Erro ao criar treino:", error);
    
    res.status(500).json({ 
      error: "Erro interno ao criar treino.",
      details: error.message,
      code: error.code
    });
  } finally {
    if (connection) connection.release();
  }
});

// ROTA CORRIGIDA - CONVIDAR JOGADORES
app.post("/api/trainings/groups/:groupId/invite", async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const { playerIds } = req.body;
  let connection;

  if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({ error: "É necessário fornecer os IDs dos jogadores a convidar." });
  }

  try {
    connection = await pool.getConnection();
    
    console.log(`🔄 Enviando convites para grupo ${groupId}:`, playerIds);

    // Preparar valores para inserção
    const values = playerIds.map(playerId => [parseInt(groupId), playerId, 'pending']);
    
    const [result] = await connection.query(
      "INSERT IGNORE INTO training_participants (trainingGroupId, playerId, invitationStatus) VALUES ?",
      [values]
    );

    console.log(`✅ ${playerIds.length} convite(s) enviado(s) com sucesso`);
    
    res.status(200).json({ 
      message: "Convites enviados com sucesso.",
      invitedPlayers: playerIds.length
    });

  } catch (error) {
    console.error("❌ Erro ao enviar convites:", error);
    res.status(500).json({ 
      error: "Erro interno ao enviar convites.",
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (connection) connection.release();
  }
});

app.patch("/api/trainings/invitations/:participantId", async (req: Request, res: Response) => {
    const { participantId } = req.params;
    const { status } = req.body;
    if (!status || !['accepted', 'declined'].includes(status)) {
        return res.status(400).json({ error: "Status inválido." });
    }
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.execute(
            "UPDATE training_participants SET invitationStatus = ? WHERE id = ?",
            [status, participantId]
        );
        res.status(200).json({ message: `Convite ${status === 'accepted' ? 'aceite' : 'recusado'} com sucesso.` });
    } catch (error) {
        console.error("Error ao responder ao convite:", error);
        res.status(500).json({ error: "Error interno ao responder ao convite." });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/users/:userId/trainings", async (req: Request, res: Response) => {
    const { userId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [trainings] = await connection.execute(
            `SELECT t.id, t.date, c.name as courseName, tg.accessCode
             FROM trainings t
             JOIN courses c ON t.courseId = c.id
             JOIN training_groups tg ON t.id = tg.trainingId
             JOIN training_participants tp ON tg.id = tp.trainingGroupId
             WHERE tp.playerId = ? AND tp.invitationStatus = 'accepted'
             ORDER BY t.date DESC`,
            [userId]
        );
        res.json(trainings);
    } catch (error) {
        console.error("Error no buscar treinos do utilizador:", error);
        res.status(500).json({ error: "Error no buscar treinos." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA CORRIGIDA - BUSCAR CONVITES PENDENTES
app.get("/api/users/:userId/invitations", async (req: Request, res: Response) => {
  const { userId } = req.params;
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    const [invites] = await connection.execute(
      `SELECT 
        tp.id as invitationId,
        p.fullName as inviterName, 
        c.name as courseName, 
        t.date,
        tg.accessCode,
        tg.id as trainingGroupId
      FROM training_participants tp
      JOIN training_groups tg ON tp.trainingGroupId = tg.id
      JOIN trainings t ON tg.trainingId = t.id
      JOIN players p ON t.creatorId = p.id
      JOIN courses c ON t.courseId = c.id
      WHERE tp.playerId = ? AND tp.invitationStatus = 'pending'
      ORDER BY t.date DESC`,
      [userId]
    );
    
    res.json(invites);
  } catch (error) {
    console.error("❌ Erro ao buscar convites:", error);
    res.status(500).json({ 
      error: "Erro ao buscar convites.",
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (connection) connection.release();
  }
});

// LINHA 730 - ROTA CORRIGIDA
app.get("/api/trainings/scorecard/:accessCode", async (req: Request, res: Response) => {
  let connection;
  try {
    const { accessCode } = req.params;
    const { playerId } = req.query;
    
    console.log(`🔍 Buscando scorecard para accessCode: ${accessCode}, playerId: ${playerId}`);

    if (!playerId) {
      return res.status(400).json({ error: "Player ID é obrigatório." });
    }

    connection = await pool.getConnection();

    // Buscar detalhes do grupo de treino
    const [groupDetails]: any[] = await connection.execute(
      `SELECT 
        tg.id as groupId, 
        tg.startHole, 
        t.id as trainingId,
        c.name as courseName, 
        c.id as courseId, 
        t.status
      FROM training_groups tg
      JOIN trainings t ON tg.trainingId = t.id
      JOIN courses c ON t.courseId = c.id
      WHERE tg.accessCode = ?`,
      [accessCode]
    );

    if (groupDetails.length === 0) {
      return res.status(404).json({ error: "Código de acesso de treino inválido." });
    }

    const group = groupDetails[0];
    group.tournamentName = "Sessão de Treino";

    // Buscar jogadores do grupo
    const [players] = await connection.execute(
      `SELECT 
        p.id, 
        p.fullName, 
        tp.teeColor
      FROM training_participants tp
      JOIN players p ON tp.playerId = p.id
      WHERE tp.trainingGroupId = ? AND tp.invitationStatus = 'accepted'`,
      [group.groupId]
    );

    group.players = players;

    // Buscar scores existentes
    const [scores] = await connection.execute(
      "SELECT playerId, holeNumber, strokes FROM training_scores WHERE trainingGroupId = ?",
      [group.groupId]
    );

    group.scores = scores;

    // Buscar buracos do campo
    const [holes]: any[] = await connection.execute(
      `SELECT 
        id, 
        courseId, 
        holeNumber, 
        par, 
        aerialImageUrl 
      FROM holes 
      WHERE courseId = ? 
      ORDER BY holeNumber`,
      [group.courseId]
    );

    // Buscar tees para cada buraco
    for (const hole of holes) {
      const [tees] = await connection.execute(
        "SELECT * FROM tees WHERE holeId = ?", 
        [hole.id]
      );
      hole.tees = tees;
    }

    group.holes = holes;
    
    console.log(`✅ Scorecar carregado: ${group.courseName}, ${players.length} jogadores`);
    res.json(group);

  } catch (error) {
    console.error("❌ Erro ao buscar dados do scorecard de treino:", error);
    res.status(500).json({ 
      error: "Erro ao buscar dados do scorecard de treino.",
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (connection) connection.release();
  }
});

// LINHA 784 - ROTA CORRIGIDA  
app.post("/api/training_scores/hole", async (req: Request, res: Response) => {
  const { groupId, holeNumber, scores } = req.body;
  let connection;

  console.log(`🎯 Salvando scores: groupId=${groupId}, hole=${holeNumber}`, scores);

  if (!groupId || !holeNumber || !scores || !Array.isArray(scores)) {
    return res.status(400).json({ error: "Dados incompletos ou em formato inválido." });
  }

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const score of scores as { playerId: number, strokes: number }[]) {
      if (score.strokes === null || score.strokes === undefined) {
        console.log(`⏭️  Pulando score vazio para player ${score.playerId}`);
        continue;
      }
      
      await connection.execute(
        `INSERT INTO training_scores (trainingGroupId, playerId, holeNumber, strokes)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE strokes = ?`,
        [groupId, score.playerId, holeNumber, score.strokes, score.strokes]
      );
      
      console.log(`✅ Score salvo: player ${score.playerId} - hole ${holeNumber} - ${score.strokes} strokes`);
    }

    await connection.commit();
    console.log(`💾 Todos os scores do buraco ${holeNumber} salvos com sucesso`);
    
    res.status(200).json({ 
      message: "Pontuações do treino salvas com sucesso.",
      hole: holeNumber,
      scoresSaved: scores.length
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("❌ Erro ao salvar pontuações do treino:", error);
    res.status(500).json({ 
      error: "Erro no servidor ao salvar pontuações.",
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/api/trainings/finish", async (req: Request, res: Response) => {
    let connection;
    try {
        const { groupId } = req.body;
        if (!groupId) {
            return res.status(400).json({ error: "ID do grupo de treino é obrigatório." });
        }
        connection = await pool.getConnection();
        await connection.execute(
            "UPDATE trainings SET status = 'completed', finishedAt = NOW() WHERE id = (SELECT trainingId FROM training_groups WHERE id = ?)",
            [groupId]
        );
        res.status(200).json({ message: "Sessão de treino finalizada com sucesso!" });
    } catch (error) {
        console.error("Erro ao finalizar treino:", error);
        res.status(500).json({ error: "Erro ao finalizar treino." });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/trainings/history/player/:playerId", async (req: Request, res: Response) => {
    let connection;
    try {
        const { playerId } = req.params;
        connection = await pool.getConnection();
        const [trainings] = await connection.execute(
            `SELECT t.id, t.date, t.finishedAt, c.name as courseName, tg.id as trainingGroupId
             FROM trainings t
             JOIN courses c ON t.courseId = c.id
             JOIN training_groups tg ON t.id = tg.trainingId
             JOIN training_participants tp ON tg.id = tp.trainingGroupId
             WHERE tp.playerId = ? AND t.status = 'completed'
             ORDER BY t.finishedAt DESC`,
            [playerId]
        );
        res.json(trainings);
    } catch (error) {
        console.error("Error as a buscar historico de treinos:", error);
        res.status(500).json({ error: "Error as a buscar historico de treinos." });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/trainings/history/:trainingGroupId/player/:playerId", async (req: Request, res: Response) => {
    let connection;
    try {
        const { playerId, trainingGroupId } = req.params;
        connection = await pool.getConnection();
        const [results]: any[] = await connection.execute(
            `SELECT ts.holeNumber, ts.strokes, h.par, tee.yardage
             FROM training_scores ts
             JOIN training_groups tg ON ts.trainingGroupId = tg.id
             JOIN trainings t ON tg.trainingId = t.id
             JOIN holes h ON ts.holeNumber = h.holeNumber AND t.courseId = h.courseId
             JOIN training_participants tp ON tg.id = tp.trainingGroupId AND ts.playerId = tp.playerId
             LEFT JOIN tees tee ON h.id = tee.holeId AND tp.teeColor = tee.color
             WHERE ts.playerId = ? AND ts.trainingGroupId = ?
             ORDER BY ts.holeNumber`,
            [playerId, trainingGroupId]
        );
        res.json(results);
    } catch (error) {
        console.error("Error as buscar detalhes do treino:", error);
        res.status(500).json({ error: "Error as buscar detalhes do treino." });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/trainings/:trainingGroupId/export/:playerId", async (req: Request, res: Response) => {
    let connection;
    try {
        const { trainingGroupId, playerId } = req.params;
        connection = await pool.getConnection();
        const [playerInfo]: any[] = await connection.execute("SELECT fullName, modality FROM players WHERE id = ?", [playerId]);
        const [trainingInfo]: any[] = await connection.execute(
            `SELECT t.date, c.name as courseName
             FROM trainings t
             JOIN training_groups tg ON t.id = tg.trainingId
             JOIN courses c ON t.courseId = c.id
             WHERE tg.id = ?`,
            [trainingGroupId]
        );
        const [scores]: any[] = await connection.execute(
            `SELECT ts.holeNumber, ts.strokes, h.par, tee.yardage
             FROM training_scores ts
             JOIN holes h ON ts.holeNumber = h.holeNumber
             JOIN training_groups tg ON ts.trainingGroupId = tg.id
             JOIN trainings t ON tg.trainingId = t.id AND h.courseId = t.courseId
             JOIN training_participants tp ON ts.playerId = tp.playerId AND ts.trainingGroupId = tp.trainingGroupId
             LEFT JOIN tees tee ON h.id = tee.holeId AND tp.teeColor = tee.color
             WHERE ts.trainingGroupId = ? AND ts.playerId = ? ORDER BY ts.holeNumber`,
            [trainingGroupId, playerId]
        );
        if (!playerInfo.length || !trainingInfo.length) {
            return res.status(404).send("Dados do treino ou jogador nao encontrados.");
        }
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Cartao de Treino');
        sheet.mergeCells('A1:C1');
        sheet.getCell('A1').value = `Cartao de Treino - ${playerInfo[0].fullName}`;
        sheet.getCell('A1').font = { size: 16, bold: true };
        sheet.addRow([]);
        sheet.addRow(['Tipo', playerInfo[0].modality]);
        sheet.addRow(['Campo', trainingInfo[0].courseName]);
        sheet.addRow(['Data', new Date(trainingInfo[0].date).toLocaleDateString('pt-BR')]);
        sheet.addRow([]);
        const headerRow = sheet.addRow(['Buraco', 'Distância', 'Par', 'Score']);
        headerRow.font = { bold: true };
        let totalStrokes = 0;
        scores.forEach((score: { holeNumber: number, yardage: number | null, par: number, strokes: number }) => {
            sheet.addRow([score.holeNumber, score.yardage ? `${score.yardage}m` : '-', score.par, score.strokes]);
            totalStrokes += score.strokes;
        });
        sheet.addRow([]);
        const totalRow = sheet.addRow(['Total', '', '', totalStrokes]);
        totalRow.font = { bold: true };
        sheet.columns.forEach((column: any) => { column.width = 15; });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + `Cartao_Treino_${playerInfo[0].fullName}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error as exportar cartão de treino:", error);
        res.status(500).json({ error: "Error as exportar." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTA DE ESTATÍSTICAS UNIFICADA (CORRIGIDA) ---
interface iStats {
    totalRounds: number;
    averageStrokes: number;
    bestGross: number;
    bestNet: number;
    eaglesOrBetter: number;
    birdies: number;
    pars: number;
    bogeys: number;
    doubleBogeysOrWorse: number;
    averagePar3: number;
    averagePar4: number;
    averagePar5: number;
    [key: string]: number;
}

app.get("/api/players/:playerId/stats", async (req: Request, res: Response) => {
    const { playerId } = req.params;
    const { type } = req.query;
    const buildQuery = (scoreTable: string, groupTable: string, roundTable: string, joinCondition: string, roundStatusFilter: string) => `
        SELECT
            COUNT(DISTINCT t.id) as totalRounds,
            AVG(s.strokes) as averageStrokes,
            MIN(player_round_scores.gross) as bestGross,
            MIN(player_round_scores.gross - gp.courseHandicap) as bestNet,
            SUM(CASE WHEN s.strokes <= h.par - 2 THEN 1 ELSE 0 END) as eaglesOrBetter,
            SUM(CASE WHEN s.strokes = h.par - 1 THEN 1 ELSE 0 END) as birdies,
            SUM(CASE WHEN s.strokes = h.par THEN 1 ELSE 0 END) as pars,
            SUM(CASE WHEN s.strokes = h.par + 1 THEN 1 ELSE 0 END) as bogeys,
            SUM(CASE WHEN s.strokes >= h.par + 2 THEN 1 ELSE 0 END) as doubleBogeysOrWorse,
            AVG(CASE WHEN h.par = 3 THEN s.strokes ELSE NULL END) as averagePar3,
            AVG(CASE WHEN h.par = 4 THEN s.strokes ELSE NULL END) as averagePar4,
            AVG(CASE WHEN h.par = 5 THEN s.strokes ELSE NULL END) as averagePar5
        FROM players p
        JOIN ${groupTable.includes('training') ? 'training_participants' : 'group_players'} gp ON p.id = gp.playerId
        JOIN ${groupTable} g ON gp.${groupTable.includes('training') ? 'trainingGroupId' : 'groupId'} = g.id
        JOIN ${roundTable} t ON g.${joinCondition} = t.id
        JOIN ${scoreTable} s ON p.id = s.playerId AND g.id = s.${groupTable.includes('training') ? 'trainingGroupId' : 'groupId'}
        JOIN courses c ON t.courseId = c.id
        JOIN holes h ON c.id = h.courseId AND s.holeNumber = h.holeNumber
        LEFT JOIN (
            SELECT
                s_inner.playerId,
                g_inner.${joinCondition},
                SUM(s_inner.strokes) as gross
            FROM ${scoreTable} s_inner
            JOIN ${groupTable} g_inner ON s_inner.${groupTable.includes('training') ? 'trainingGroupId' : 'groupId'} = g_inner.id
            GROUP BY s_inner.playerId, g_inner.${joinCondition}
        ) as player_round_scores ON s.playerId = player_round_scores.playerId AND t.id = player_round_scores.${joinCondition}
        WHERE p.id = ? ${roundStatusFilter}
    `;

    const emptyStats: iStats = { totalRounds: 0, averageStrokes: 0, bestGross: 0, bestNet: 0, eaglesOrBetter: 0, birdies: 0, pars: 0, bogeys: 0, doubleBogeysOrWorse: 0, averagePar3: 0, averagePar4: 0, averagePar5: 0 };
    let connection;
    try {
        connection = await pool.getConnection();
        let finalStats: iStats = { ...emptyStats };
        if (type == 'tournament' || !type || type === 'all') {
            const query = buildQuery("scores", "`groups`", "tournaments", "tournamentId", "AND t.status = 'completed'");
            const [rows]: any[] = await connection.execute(query, [playerId]);
            if (rows.length > 0 && rows[0].totalRounds > 0) finalStats = { ...rows[0] };
        }
        if (type == 'training' || !type || type === 'all') {
            const query = buildQuery("training_scores", "training_groups", "trainings", "trainingId", "AND t.status = 'completed'");
            const [rows]: any[] = await connection.execute(query, [playerId]);
            if (rows.length > 0 && rows[0].totalRounds > 0) {
                if (type === 'all' && finalStats.totalRounds > 0) {
                    Object.keys(finalStats).forEach(key => {
                        if (key.startsWith('average') || key.startsWith('best')) {
                            finalStats[key] = Math.min(finalStats[key], rows[0][key]);
                        } else {
                            finalStats[key] += rows[0][key];
                        }
                    });
                } else {
                    finalStats = { ...rows[0] };
                }
            }
        }
        Object.keys(finalStats).forEach(key => {
            const statKey = key as keyof iStats;
            if (finalStats[statKey] === null) {
                finalStats[statKey] = 0;
            } else if (typeof finalStats[statKey] === 'string') {
                finalStats[statKey] = parseFloat(parseFloat(finalStats[statKey] as any).toFixed(2));
            }
        });
        res.json(finalStats);
    } catch (error) {
        console.error("Error to buscar estatisticas:", error);
        res.status(500).json({ error: "Error to buscar estatisticas." });
    } finally {
        if (connection) connection.release();
    }
});
// ADICIONE ESTA ROTA NO server.ts - Buscar jogadores para convite
app.get("/api/players/search", async (req: Request, res: Response) => {
  const { search, excludeTrainingGroup } = req.query;
  let connection;

  try {
    connection = await pool.getConnection();
    
    let query = `
      SELECT 
        p.id,
        p.fullName,
        p.email,
        p.gender
      FROM players p
      WHERE p.role != 'admin'
    `;
    
    const params: any[] = [];

    // Filtro de busca por nome
    if (search) {
      query += " AND p.fullName LIKE ?";
      params.push(`%${search}%`);
    }

    // Excluir jogadores já no grupo de treino
    if (excludeTrainingGroup) {
      query += ` AND p.id NOT IN (
        SELECT tp.playerId 
        FROM training_participants tp 
        WHERE tp.trainingGroupId = ?
      )`;
      params.push(excludeTrainingGroup);
    }

    query += " ORDER BY p.fullName ASC LIMIT 20";

    const [players] = await connection.execute(query, params);
    
    res.json(players);
  } catch (error) {
    console.error("Erro ao buscar jogadores:", error);
    res.status(500).json({ 
      error: "Erro ao buscar jogadores",
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (connection) connection.release();
  }
});
app.delete("/api/tournaments/:id", async (req: Request, res: Response) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        await connection.execute("DELETE FROM tournaments WHERE id = ?", [id]);
        res.status(200).json({ message: "Torneio apagado com sucesso." });
    } catch (error) {
        console.error("Erro ao apagar torneio:", error);
        res.status(500).json({ error: "Erro ao apagar torneio." });
    } finally {
        if (connection) connection.release();
    }
});

app.put("/api/tournaments/:id", async (req: Request, res: Response) => {
    let connection;
    try {
        const { id } = req.params;
        const { bannerImageUrl, paymentInstructions } = req.body;
        connection = await pool.getConnection();
        await connection.execute(
            `UPDATE tournaments
             SET bannerImageUrl = ?, paymentInstructions = ?
             WHERE id = ?`,
            [bannerImageUrl, paymentInstructions, id]
        );
        res.status(200).json({ message: "Configurações do torneio atualizadas com sucesso." });
    } catch (error) {
        console.error("Erro ao atualizar configurações do torneio:", error);
        res.status(500).json({ error: "Erro ao atualizar as configurações do torneio." });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/tournaments/:id/finish", async (req: Request, res: Response) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        await connection.execute(
            "UPDATE tournaments SET status = 'completed' WHERE id = ?",
            [id]
        );
        res.status(200).json({ message: "Torneio finalizado com sucesso!" });
    } catch (error) {
        console.error("Erro ao finalizar torneio:", error);
        res.status(500).json({ error: "Erro ao finalizar torneio." });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments/:tournamentId/tees", async (req: Request, res: Response) => {
    let connection;
    try {
        const { tournamentId } = req.params;
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            `SELECT DISTINCT t.color
             FROM tees t
             JOIN holes h ON t.holeId = h.id
             JOIN courses c ON h.courseId = c.id
             JOIN tournaments tour ON c.id = tour.courseId
             WHERE tour.id = ?`,
            [tournamentId]
        );
        res.json(rows);
    } catch (error) {
        console.error("Error ao buscar tees do torneio:", error);
        res.status(500).json({ error: "Error ao buscar tees." });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments/:tournamentId/export-groups", async (req: Request, res: Response) => {
    let connection;
    try {
        const { tournamentId } = req.params;
        connection = await pool.getConnection();
        const [tournamentRows]: any[] = await connection.execute(
            "SELECT name, date, startTime FROM tournaments WHERE id = ?",
            [tournamentId]
        );
        if (tournamentRows.length === 0) {
            return res.status(404).json({ error: "Torneio não encontrado." });
        }
        const tournament = tournamentRows[0];
        const TEE_TIME_INTERVAL = 10;
        const [groupRows]: any[] = await connection.execute(
            `SELECT g.id as groupId, g.startHole, g.accessCode, p.fullName
             FROM \`groups\` g
             JOIN group_players gp ON g.id = gp.groupId
             JOIN players p ON gp.playerId = p.id
             WHERE g.tournamentId = ?
             ORDER BY g.startHole, g.id, p.fullName`,
            [tournamentId]
        );
        if (groupRows.length === 0) {
            return res.status(404).json({ error: "Nenhum grupo encontrado para este torneio." });
        }
        const groupsByHole = groupRows.reduce((acc: any, row: any) => {
            const { startHole, groupId, ...playerData } = row;
            if (!acc[startHole]) acc[startHole] = new Map();
            if (!acc[startHole].has(groupId)) {
                acc[startHole].set(groupId, { ...playerData, players: [] });
            }
            acc[startHole].get(groupId).players.push(playerData.fullName);
            return acc;
        }, {} as Record<string, Map<number, any>>);
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Birdify";
        const sheet = workbook.addWorksheet("Horários de Saída");
        sheet.mergeCells("A1:D1");
        const titleCell = sheet.getCell("A1");
        titleCell.value = tournament.name.toUpperCase();
        titleCell.font = { name: "Calibri", size: 16, bold: true };
        titleCell.alignment = { vertical: "middle", horizontal: "center" };
        let currentRow = 3;
        for (const hole in groupsByHole) {
            const groups = Array.from(groupsByHole[hole].values());
            sheet.mergeCells(`A${currentRow}:D${currentRow}`);
            const teeTitleCell = sheet.getCell(`A${currentRow}`);
            teeTitleCell.value = `HORÁRIO DE SAÍDA - TEE ${hole}`;
            teeTitleCell.font = {
                name: "Calibri",
                size: 12,
                bold: true,
                color: { argb: "FFFFFFFF" },
            };
            teeTitleCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF4F81BD" },
            };
            teeTitleCell.alignment = { vertical: "middle", horizontal: "center" };
            currentRow++;
            const headerRow = sheet.addRow(["HORA", "MATCH", "JOGADORES", "CÓDIGO"]);
            headerRow.font = { bold: true };
            headerRow.alignment = { vertical: "middle", horizontal: "center" };
            currentRow++;
            let matchNumber = 1;
            let teeTime = new Date(`${tournament.date.toISOString().split("T")[0]} ${tournament.startTime || "08:00:00"}`);
            groups.forEach((group: any) => {
                const formattedTime = teeTime.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                });
                const startRow = currentRow;
                group.players.forEach((playerName: string, index: number) => {
                    if (index == 0) {
                        sheet.addRow([formattedTime, matchNumber, playerName, group.accessCode]);
                    } else {
                        sheet.addRow(["", "", playerName, ""]);
                    }
                });
                const endRow = currentRow + group.players.length - 1;
                if (group.players.length > 1) {
                    sheet.mergeCells(`A${startRow}:A${endRow}`);
                    sheet.mergeCells(`B${startRow}:B${endRow}`);
                    sheet.mergeCells(`D${startRow}:D${endRow}`);
                }
                sheet.getCell(`A${startRow}`).alignment = { vertical: "middle", horizontal: "center" };
                sheet.getCell(`B${startRow}`).alignment = { vertical: "middle", horizontal: "center" };
                sheet.getCell(`D${startRow}`).alignment = { vertical: "middle", horizontal: "center" };
                currentRow = endRow + 1;
                matchNumber++;
                teeTime.setMinutes(teeTime.getMinutes() + TEE_TIME_INTERVAL);
            });
            currentRow++;
        }
        sheet.columns.forEach((column) => {
            let maxLength = 0;
            column.eachCell!({ includeEmpty: true }, (cell) => {
                let columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength;
        });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=Horarios_de_Saida.xlsx");
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error as exportar grupos:", error);
        res.status(500).json({ error: "Error as exportar grupos." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTAS PARA JOGADORES (PLAYERS) ---
app.get("/api/players", async (req: Request, res: Response) => {
    let connection;
    try {
        const { tournamentId, modality } = req.query;
        connection = await pool.getConnection();
        let params: any[] = [];
        let query = "SELECT id, fullName, gender FROM players WHERE role != 'admin'";
        if (modality) {
            query += " AND modality = ?";
            params.push(modality);
        }
        if (tournamentId) {
            query += ` AND id NOT IN (
                SELECT gp.playerId FROM group_players gp
                JOIN \`groups\` g ON gp.groupId = g.id
                WHERE g.tournamentId = ?
            )`;
            params.push(tournamentId);
        }
        query += " ORDER BY fullName";
        const [rows] = await connection.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Error as buscar jogadores:", error);
        res.status(500).json({ error: "Error as buscar jogadores" });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/players", async (req: Request, res: Response) => {
    let connection;
    try {
        const { fullName, email, password, gender, modality, club, birthDate } = req.body;
        if (!fullName || !email || !password || !gender || !modality) {
            return res.status(400).json({ error: "Campos essenciais em falta." });
        }
        if (modality === 'Footgolf' && !birthDate) {
            return res.status(400).json({ error: "Data de nascimento é obrigatória para a modalidade Footgolf." });
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        connection = await pool.getConnection();
        const query = `INSERT INTO players (fullName, email, password, gender, birthDate, modality, club)
                       VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result]: any = await connection.execute(query, [
            fullName, email, hashedPassword, gender, birthDate || null, modality, club || null,
        ]);
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error: any) {
        console.error("Error ao cadastrar jogador:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "O Email fornecido já está em uso." });
        }
        res.status(500).json({ error: "Erro ao cadastrar jogador." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTAS PARA GRUPOS (GROUPS) ---
app.get("/api/tournaments/:tournamentId/groups", async (req: Request, res: Response) => {
    let connection;
    try {
        const { tournamentId } = req.params;
        connection = await pool.getConnection();
        const [groups]: any[] = await connection.execute(
            "SELECT * FROM `groups` WHERE tournamentId = ?",
            [tournamentId]
        );
        for (const group of groups) {
            const [players] = await connection.execute(
                `SELECT p.id, p.fullName, p.gender, gp.isResponsible, gp.teeColor
                 FROM group_players gp
                 JOIN players p ON gp.playerId = p.id
                 WHERE gp.groupId = ?`,
                [group.id]
            );
            group.players = players;
        }
        res.json(groups);
    } catch (error) {
        console.error("Error as a buscar grupos:", error);
        res.status(500).json({ error: "Error as a buscar grupos do torneio" });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/groups", async (req: Request, res: Response) => {
    let connection;
    try {
        const { tournamentId, startHole, players, responsiblePlayerId, category } = req.body;
        const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [groupResult]: any = await connection.execute(
            "INSERT INTO `groups` (tournamentId, startHole, accessCode, category) VALUES (?, ?, ?, ?)",
            [tournamentId, startHole, accessCode, category]
        );
        const newGroupId = groupResult.insertId;
        for (const player of players) {
            await connection.execute(
                "INSERT INTO group_players (groupId, playerId, isResponsible, teeColor) VALUES (?, ?, ?, ?)",
                [newGroupId, player.id, player.id === responsiblePlayerId, player.teeColor]
            );
        }
        await connection.commit();
        res.status(201).json({ message: "Grupo criado com sucesso!", accessCode });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao criar grupo:", error);
        res.status(500).json({ error: "Erro ao criar o grupo" });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/groups/:id", async (req: Request, res: Response) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        const [groupRows]: any[] = await connection.execute(
            "SELECT * FROM `groups` WHERE id = ?",
            [id]
        );
        if (groupRows.length == 0) {
            return res.status(404).json({ error: "Grupo não encontrado." });
        }
        const group = groupRows[0];
        const [players] = await connection.execute(
            `SELECT p.id, p.fullName, p.gender, gp.isResponsible, gp.teeColor
             FROM group_players gp
             JOIN players p ON gp.playerId = p.id
             WHERE gp.groupId = ?`,
            [group.id]
        );
        group.players = players;
        res.json(group);
    } catch (error) {
        console.error("Erro ao buscar detalhes do grupo:", error);
        res.status(500).json({ error: "Erro ao buscar detalhes do grupo." });
    } finally {
        if (connection) connection.release();
    }
});

app.put("/api/groups/:id", async (req: Request, res: Response) => {
    let connection;
    try {
        const { id } = req.params;
        const { startHole, players, responsiblePlayerId, category } = req.body;
        connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.execute(
            "UPDATE `groups` SET startHole = ?, category = ? WHERE id = ?",
            [startHole, category, id]
        );
        await connection.execute("DELETE FROM group_players WHERE groupId = ?", [id]);
        for (const player of players) {
            await connection.execute(
                "INSERT INTO group_players (groupId, playerId, isResponsible, teeColor) VALUES (?, ?, ?, ?)",
                [id, player.id, player.id === responsiblePlayerId, player.teeColor]
            );
        }
        await connection.commit();
        res.status(200).json({ message: "Grupo atualizado com sucesso!" });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar grupo:", error);
        res.status(500).json({ error: "Erro ao atualizar o grupo." });
    } finally {
        if (connection) connection.release();
    }
});

app.delete("/api/groups/:id", async (req: Request, res: Response) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        await connection.execute("DELETE FROM `groups` WHERE id = ?", [id]);
        res.status(200).json({ message: "Grupo apagado com sucesso." });
    } catch (error) {
        console.error("Erro ao apagar grupo:", error);
        res.status(500).json({ error: "Erro ao apagar grupo." });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/groups/handicaps", async (req: Request, res: Response) => {
    let connection;
    try {
        const { groupId, handicaps } = req.body;
        if (!groupId || !handicaps) {
            return res.status(400).json({ error: "Dados incompletos." });
        }
        connection = await pool.getConnection();
        for (const playerId in handicaps) {
            const courseHandicap = handicaps[playerId];
            await connection.execute(
                "UPDATE group_players SET courseHandicap = ? WHERE groupId = ? AND playerId = ?",
                [courseHandicap, groupId, playerId]
            );
        }
        res.status(200).json({ message: "Handicaps atualizados com sucesso." });
    } catch (error) {
        console.error("Erro ao atualizar handicaps:", error);
        res.status(500).json({ error: "Erro ao atualizar handicaps." });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/groups/finish", async (req: Request, res: Response) => {
    let connection;
    try {
        const { groupId } = req.body;
        if (!groupId) {
            return res.status(400).json({ error: "ID do grupo é obrigatório." });
        }
        connection = await pool.getConnection();
        await connection.execute(
            "UPDATE `groups` SET status = 'completed' WHERE id = ?",
            [groupId]
        );
        res.status(200).json({ message: "Rodada finalizada com sucesso!" });
    } catch (error) {
        console.error("Erro ao finalizar rodada:", error);
        res.status(500).json({ error: "Erro ao finalizar rodada." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTA DE LOGIN ---
app.post("/api/login", async (req: Request, res: Response) => {
    let connection;
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email e senha são obrigatórios." });
        }
        connection = await pool.getConnection();
        const query = "SELECT id, fullName, email, cpf, role, gender, modality, password FROM players WHERE email = ?";
        const [rows]: any[] = await connection.execute(query, [email]);
        if (rows.length === 0) {
            return res.status(401).json({ error: "Email ou senha inválidos." });
        }
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const { password: _, ...userWithoutPassword } = user;
            res.status(200).json({ user: userWithoutPassword });
        } else {
            res.status(401).json({ error: "Email ou senha inválidos." });
        }
    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ error: "Erro interno no servidor." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTAS DE SCORECARD ---
app.get("/api/scorecard/:accessCode", async (req: Request, res: Response) => {
    let connection;
    try {
        const { accessCode } = req.params;
        const { playerId } = req.query;
        if (!playerId) {
            return res.status(400).json({ error: "Player ID é obrigatório para aceder ao scorecard." });
        }
        connection = await pool.getConnection();
        const [groupDetails]: any[] = await connection.execute(
            `SELECT g.id as groupId, g.startHole, g.status, t.id as tournamentId, t.name as tournamentName, c.name as courseName, c.id as courseId
             FROM \`groups\` g
             JOIN tournaments t ON g.tournamentId = t.id
             JOIN courses c ON t.courseId = c.id
             WHERE g.accessCode = ?`,
            [accessCode]
        );
        if (groupDetails.length === 0) {
            return res.status(404).json({ error: "Código de acesso inválido." });
        }
        const group = groupDetails[0];
        const [userRole]: any[] = await connection.execute(
            "SELECT role FROM players WHERE id = ?",
            [playerId]
        );
        const isAdmin = userRole.length > 0 && userRole[0].role === "admin";
        if (!isAdmin) {
            const [playersInGroup]: any[] = await connection.execute(
                "SELECT playerId FROM group_players WHERE groupId = ?",
                [group.groupId]
            );
            const isPlayerInGroup = playersInGroup.some(
                (p: { playerId: any }) => p.playerId.toString() === playerId
            );
            if (!isPlayerInGroup) {
                return res.status(403).json({ error: "Acesso negado: você não pertence a este grupo." });
            }
        }
        const [players] = await connection.execute(
            `SELECT p.id, p.fullName, gp.teeColor
             FROM group_players gp
             JOIN players p ON gp.playerId = p.id
             WHERE gp.groupId = ?`,
            [group.groupId]
        );
        group.players = players;
        const [scores] = await connection.execute(
            "SELECT playerId, holeNumber, strokes FROM scores WHERE groupId = ?",
            [group.groupId]
        );
        group.scores = scores;
        const [holes]: any[] = await connection.execute(
            "SELECT id, courseId, holeNumber, par, aerialImageUrl FROM holes WHERE courseId = ? ORDER BY holeNumber",
            [group.courseId]
        );
        for (const hole of holes) {
            const [tees] = await connection.execute("SELECT * FROM tees WHERE holeId = ?", [hole.id]);
            hole.tees = tees;
        }
        group.holes = holes;
        res.json(group);
    } catch (error) {
        console.error("Error as buscar dados do scorecard:", error);
        res.status(500).json({ error: "Error as buscar dados do scorecard." });
    } finally {
        if (connection) connection.release();
    }
});

// — ROTAS DE LEADERBOARD E HISTÓRICO —
app.get("/api/leaderboard/:tournamentId", async (req: Request, res: Response) => {
    let connection;
    try {
        const { tournamentId } = req.params;
        connection = await pool.getConnection();
        const [players]: any[] = await connection.execute(
            `SELECT p.id, p.fullName, p.gender, gp.courseHandicap, g.id as groupId
             FROM players p
             JOIN group_players gp ON p.id = gp.playerId
             JOIN \`groups\` g ON gp.groupId = g.id
             WHERE g.tournamentId = ?`,
            [tournamentId]
        );
        interface Hole { holeNumber: number; par: number; }
        const [holes] = await connection.execute(
            `SELECT h.holeNumber, h.par FROM holes h
             JOIN courses c ON h.courseId = c.id
             JOIN tournaments t ON c.id = t.courseId
             WHERE t.id = ? ORDER BY h.holeNumber`,
            [tournamentId]
        );
        const parMap = new Map((holes as { holeNumber: number; par: number }[]).map((h) => [h.holeNumber, h.par]));
        for (const player of players) {
            const [scores] = await connection.execute(
                "SELECT holeNumber, strokes FROM scores WHERE playerId = ? AND groupId = ?",
                [player.id, player.groupId]
            );
            const typedScores = scores as { holeNumber: number; strokes: number }[];
            player.grossTotal = typedScores.reduce((sum, score) => sum + score.strokes, 0);
            let toPar = 0;
            for (const score of typedScores) {
                toPar += score.strokes - (parMap.get(score.holeNumber) || 0);
            }
            player.toPar = toPar;
            player.netToPar = toPar - (player.courseHandicap || 0);
            player.through = typedScores.length;
        }
        const typedPlayers = players as any[];
        typedPlayers.sort((a, b) => a.netToPar - b.netToPar);
        let rank = 1;
        for (let i = 0; i < typedPlayers.length; i++) {
            if (i > 0 && typedPlayers[i].netToPar > typedPlayers[i - 1].netToPar) {
                rank = i + 1;
            }
            typedPlayers[i].rank = rank;
        }
        res.json(typedPlayers);
    } catch (error) {
        console.error("Error so calcular leaderboard:", error);
        res.status(500).json({ error: "Error so calcular leaderboard." });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/history/player/:playerId", async (req: Request, res: Response) => {
    let connection;
    try {
        const { playerId } = req.params;
        connection = await pool.getConnection();
        const [tournaments] = await connection.execute(
            `SELECT DISTINCT t.id, t.name, t.date, c.name as courseName
             FROM tournaments t
             JOIN \`groups\` g ON t.id = g.tournamentId
             JOIN group_players gp ON g.id = gp.groupId
             JOIN courses c ON t.courseId = c.id
             WHERE gp.playerId = ? AND t.status = 'completed'
             ORDER BY t.date DESC`,
            [playerId]
        );
        res.json(tournaments);
    } catch (error) {
        console.error("Error no buscar histórico do jogador:", error);
        res.status(500).json({ error: "Error no buscar histórico." });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/history/player/:playerId/tournament/:tournamentId", async (req: Request, res: Response) => {
    let connection;
    try {
        const { playerId, tournamentId } = req.params;
        connection = await pool.getConnection();
        const [results]: any[] = await connection.execute(
            `SELECT s.holeNumber, s.strokes, h.par, tee.yardage
             FROM scores s
             JOIN \`groups\` g ON s.groupId = g.id
             JOIN holes h ON s.holeNumber = h.holeNumber
             JOIN tournaments t ON g.tournamentId = t.id
             JOIN group_players gp ON g.id = gp.groupId AND s.playerId = gp.playerId
             LEFT JOIN tees tee ON h.id = tee.holeId AND gp.teeColor = tee.color
             WHERE s.playerId = ? AND g.tournamentId = ? AND t.courseId = h.courseId
             ORDER BY s.holeNumber`,
            [playerId, tournamentId]
        );
        res.json(results);
    } catch (error) {
        console.error("Error as buscar detalhes do torneio do jogador:", error);
        res.status(500).json({ error: "Erro ao buscar detalhes do torneio." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTA DE EXPORTAÇÃO EXCEL ---
app.get("/api/tournaments/:tournamentId/export", async (req: Request, res: Response) => {
    let connection;
    try {
        const { tournamentId } = req.params;
        connection = await pool.getConnection();
        const [players]: any[] = await connection.execute(
            `SELECT p.id, p.fullName, p.gender, gp.courseHandicap, s.holeNumber, s.strokes
             FROM players p
             JOIN group_players gp ON p.id = gp.playerId
             JOIN \`groups\` g ON gp.groupId = g.id
             LEFT JOIN scores s ON gp.playerId = s.playerId AND gp.groupId = s.groupId
             WHERE g.tournamentId = ?
             ORDER BY p.fullName, s.holeNumber`,
            [tournamentId]
        );
        if (players.length == 0) {
            return res.status(404).send("Nenhum jogador encontrado para este torneio.");
        }
        const playerData = new Map();
        for (const row of players) {
            if (!playerData.has(row.id)) {
                playerData.set(row.id, {
                    id: row.id,
                    name: row.fullName,
                    gender: row.gender,
                    handicap: row.courseHandicap || 0,
                    scores: new Map(),
                    tiebreakApplied: "",
                });
            }
            if (row.holeNumber) {
                playerData.get(row.id).scores.set(row.holeNumber, row.strokes);
            }
        }
        const processedPlayers = Array.from(playerData.values());
        for (const player of processedPlayers) {
            player.gross = 0;
            for (let i = 1; i <= 18; i++) {
                player.gross += player.scores.get(i) || 0;
            }
            player.net = player.gross - player.handicap;
        }
        const calculateTiebreakScore = (player: any, holes: number[], hcpFraction: number): number => {
            const gross = holes.reduce((sum, holeNum) => sum + (player.scores.get(holeNum) || 0), 0);
            return gross - player.handicap * hcpFraction;
        };
        const tiebreakCriteria = [
            { holes: [10, 11, 12, 13, 14, 15, 16, 17, 18], hcpFraction: 1 / 2, description: "Desempate: Últimos 9" },
            { holes: [13, 14, 15, 16, 17, 18], hcpFraction: 1 / 3, description: "Desempate: Últimos 6" },
            { holes: [16, 17, 18], hcpFraction: 1 / 6, description: "Desempate: Últimos 3" },
            { holes: [18], hcpFraction: 1 / 18, description: "Desempate: Último Buraco" },
            { holes: [1, 2, 3, 4, 5, 6, 7, 8, 9], hcpFraction: 1 / 2, description: "Desempate: Primeiros 9" },
            { holes: [4, 5, 6, 7, 8, 9], hcpFraction: 1 / 3, description: "Desempate: Primeiros 6" },
            { holes: [7, 8, 9], hcpFraction: 1 / 6, description: "Desempate: Primeiros 3" },
            { holes: [9], hcpFraction: 1 / 18, description: "Desempate: Buraco 9" },
        ];
        const comparePlayers = (a: any, b: any) => {
            if (a.net != b.net) return a.net - b.net;
            for (const criterion of tiebreakCriteria) {
                const scoreA = calculateTiebreakScore(a, criterion.holes, criterion.hcpFraction);
                const scoreB = calculateTiebreakScore(b, criterion.holes, criterion.hcpFraction);
                if (Math.abs(scoreA - scoreB) > 0.001) {
                    if (a.tiebreakApplied === "") a.tiebreakApplied = criterion.description;
                    if (b.tiebreakApplied === "") b.tiebreakApplied = criterion.description;
                    return scoreA - scoreB;
                }
            }
            return 0;
        };
        const netSortedPlayers = [...processedPlayers].sort(comparePlayers);
        const grossSortedPlayers = [...processedPlayers].sort((a, b) => a.gross - b.gross);
        const categories = {
            M1: { name: "Categoria M1 (0 a 8.5)", gender: "Male", min: 0, max: 8.5, players: [] as any[] },
            M2: { name: "Categoria M2 (8.6 a 14)", gender: "Male", min: 8.6, max: 14.0, players: [] as any[] },
            M3: { name: "Categoria M3 (14.1 a 22.1)", gender: "Male", min: 14.1, max: 22.1, players: [] as any[] },
            M4: { name: "Categoria M4 (22.2 a 36.4)", gender: "Male", min: 22.2, max: 36.4, players: [] as any[] },
            F1: { name: "Categoria F1 (0 a 16.0)", gender: "Female", min: 0, max: 16.0, players: [] as any[] },
            F2: { name: "Categoria F2 (16.1 a 23.7)", gender: "Female", min: 16.1, max: 23.7, players: [] as any[] },
            F3: { name: "Categoria F3 (23.8 a 36.4)", gender: "Female", min: 23.8, max: 36.4, players: [] as any[] },
        };
        for (const player of processedPlayers) {
            for (const catKey in categories) {
                const cat = categories[catKey as keyof typeof categories];
                if (player.gender === cat.gender && player.handicap >= cat.min && player.handicap <= cat.max) {
                    cat.players.push(player);
                    break;
                }
            }
        }
        for (const catKey in categories) {
            categories[catKey as keyof typeof categories].players.sort(comparePlayers);
        }
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Birdify";
        const addDetailedSheet = (sheetName: string, players: any[], includeTiebreakCol: boolean) => {
            const sheet = workbook.addWorksheet(sheetName);
            const columns: Partial<ExcelJS.Column>[] = [
                { header: "Pos.", key: "pos", width: 5 },
                { header: "Nome", key: "name", width: 30 },
                { header: "HDC", key: "handicap", width: 8 },
            ];
            for (let i = 1; i <= 9; i++) columns.push({ header: `B${i}`, key: `h${i}`, width: 5 });
            columns.push({ header: "1ª Volta", key: "ida", width: 8 });
            for (let i = 10; i <= 18; i++) columns.push({ header: `B${i}`, key: `h${i}`, width: 5 });
            columns.push({ header: "2ª Volta", key: "volta", width: 8 });
            columns.push({ header: "GROSS", key: "gross", width: 8 });
            columns.push({ header: "NET", key: "net", width: 8 });
            if (includeTiebreakCol) {
                columns.push({ header: "Desempate Aplicado", key: "tiebreak", width: 20 });
            }
            sheet.columns = columns;
            players.forEach((p, i) => {
                const rowData: any = { pos: i + 1, name: p.name, handicap: p.handicap };
                let ida = 0, volta = 0;
                for (let h = 1; h <= 18; h++) {
                    const score = p.scores.get(h) || 0;
                    rowData[`h${h}`] = score;
                    if (h <= 9) ida += score;
                    else volta += score;
                }
                rowData.ida = ida;
                rowData.volta = volta;
                rowData.gross = p.gross;
                rowData.net = p.net;
                if (includeTiebreakCol) rowData.tiebreak = p.tiebreakApplied;
                sheet.addRow(rowData);
            });
        };
        addDetailedSheet("Leaderboard Geral (NET)", netSortedPlayers, true);
        const grossSheet = workbook.addWorksheet("Campeões Gross");
        grossSheet.columns = [
            { header: "Pos:", key: "pos", width: 5 },
            { header: "Nome", key: "name", width: 30 },
            { header: "GROSS", key: "gross", width: 10 },
        ];
        grossSortedPlayers.forEach((p, i) => {
            grossSheet.addRow({ pos: i + 1, name: p.name, gross: p.gross });
        });
        for (const catKey in categories) {
            const cat = categories[catKey as keyof typeof categories];
            if (cat.players.length > 0) addDetailedSheet(catKey, cat.players, true);
        }
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=Relatorio_Torneio_Detalhado.xlsx");
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error as exportar relatório:", error);
        res.status(500).json({ error: "Error as exportar relatório." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTA PARA ESTATÍSTICAS DO JOGADOR ---
app.get("/api/players/:playerId/stats", async (req: Request, res: Response) => {
    let connection;
    try {
        const { playerId } = req.params;
        connection = await pool.getConnection();
        const query = `
            SELECT
                COUNT(DISTINCT t.id) as totalRounds,
                AVG(s.strokes) as averageStrokes,
                MIN(player_round_scores.gross) as bestGross,
                MIN(player_round_scores.gross - gp.courseHandicap) as bestNet,
                SUM(CASE WHEN s.strokes <= h.par - 2 THEN 1 ELSE 0 END) as eaglesOrBetter,
                SUM(CASE WHEN s.strokes = h.par - 1 THEN 1 ELSE 0 END) as birdies,
                SUM(CASE WHEN s.strokes = h.par THEN 1 ELSE 0 END) as pars,
                SUM(CASE WHEN s.strokes = h.par + 1 THEN 1 ELSE 0 END) as bogeys,
                SUM(CASE WHEN s.strokes >= h.par + 2 THEN 1 ELSE 0 END) as doubleBogeysOrWorse,
                AVG(CASE WHEN h.par = 3 THEN s.strokes ELSE NULL END) as averagePar3,
                AVG(CASE WHEN h.par = 4 THEN s.strokes ELSE NULL END) as averagePar4,
                AVG(CASE WHEN h.par = 5 THEN s.strokes ELSE NULL END) as averagePar5
            FROM players p
            JOIN group_players gp ON p.id = gp.playerId
            JOIN \`groups\` g ON gp.groupId = g.id
            JOIN tournaments t ON g.tournamentId = t.id
            JOIN scores s ON gp.playerId = s.playerId AND gp.groupId = s.groupId
            JOIN courses c ON t.courseId = c.id
            JOIN holes h ON c.id = h.courseId AND s.holeNumber = h.holeNumber
            LEFT JOIN (
                SELECT s_inner.playerId, g_inner.tournamentId, SUM(s_inner.strokes) as gross
                FROM scores s_inner
                JOIN \`groups\` g_inner ON s_inner.groupId = g_inner.id
                GROUP BY s_inner.playerId, g_inner.tournamentId
            ) as player_round_scores ON s.playerId = player_round_scores.playerId AND t.id = player_round_scores.tournamentId
            WHERE p.id = ? AND t.status = 'completed'
            GROUP BY p.id`;
        const [rows]: any[] = await connection.execute(query, [playerId]);
        if (rows.length > 0) {
            const stats = rows[0];
            for (const key in stats) {
                if (stats[key] == null) stats[key] = 0;
                else if (typeof stats[key] == "string") stats[key] = parseFloat(parseFloat(stats[key]).toFixed(2));
            }
            res.json(stats);
        } else {
            res.json({
                totalRounds: 0, averageStrokes: 0, bestGross: 0, bestNet: 0, eaglesOrBetter: 0, birdies: 0,
                pars: 0, bogeys: 0, doubleBogeysOrWorse: 0, averagePar3: 0, averagePar4: 0, averagePar5: 0,
            });
        }
    } catch (error) {
        console.error("Error as a buscar estatisticas do jogador:", error);
        res.status(500).json({ error: "Error as a buscar estatisticas." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTAS PARA REDEFINICÃO DE SENHA ---
app.post("/api/forgot-password", async (req: Request, res: Response) => {
    const { email } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows]: any[] = await connection.execute("SELECT * FROM players WHERE email = ?", [email]);
        if (rows.length === 0) {
            return res.status(200).json({
                message: "Se o seu email estiver em nossa base de dados, você receberá um link para redefinir sua senha."
            });
        }
        const user = rows[0];
        const token = crypto.randomBytes(20).toString("hex");
        const expires = new Date(Date.now() + 3600000);
        await connection.execute(
            "UPDATE players SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?",
            [token, expires, user.id]
        );
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: "suporte.birdify@gmail.com", pass: "free leiz flor vrvq" },
        });
        const mailOptions = {
            to: user.email,
            from: "Birdify <suporte.birdify@gmail.com>",
            subject: "Redefinição de Senha - Birdify",
            text: `Você está recebendo este email porque você (ou outra pessoa) solicitou a redefinição da sua senha.\n\n` +
                  `Por favor, clique no link a seguir ou cole-o no seu navegador para completar o processo:\n\n` +
                  `http://localhost:5173/reset/${token}\n\n` +
                  `Se você não solicitou isso, por favor, ignore este email e sua senha permanecerá inalterada.\n`,
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Um email foi enviado com as instruções para redefinir a sua senha." });
    } catch (error) {
        console.error("Erro em forgot-password:", error);
        res.status(500).json({ error: "Erro ao processar o pedido de redefinição de senha." });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/reset-password", async (req: Request, res: Response) => {
    const { token, password } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows]: any[] = await connection.execute(
            "SELECT * FROM players WHERE resetPasswordToken = ? AND resetPasswordExpires > NOW()",
            [token]
        );
        if (rows.length === 0) {
            return res.status(400).json({ error: "O token para redefinição de senha é inválido ou expirou." });
        }
        const user = rows[0];
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await connection.execute(
            "UPDATE players SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?",
            [hashedPassword, user.id]
        );
        res.status(200).json({ message: "Sua senha foi redefinida com sucesso!" });
    } catch (error) {
        console.error("Erro em reset-password:", error);
        res.status(500).json({ error: "Erro ao redefinir a senha." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTAS PARA GESTÃO DE PERGUNTAS DE INSCRIÇÃO ---
app.get("/api/tournaments/:tournamentId/questions", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [questions]: any[] = await connection.execute(
            'SELECT * FROM tournament_questions WHERE tournamentId = ? ORDER BY id ASC',
            [tournamentId]
        );
        for (const question of questions) {
            if (question.questionType === 'MULTIPLE_CHOICE') {
                const [options] = await connection.execute(
                    'SELECT * FROM question_options WHERE questionId = ? ORDER BY id ASC',
                    [question.id]
                );
                question.options = options;
            }
        }
        res.json(questions);
    } catch (error) {
        console.error("Error as buscar perguntas do torneio:", error);
        res.status(500).json({ error: "Error as buscar perguntas do torneio." });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/tournaments/:tournamentId/questions", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    const { questionText, questionType, isRequired, options } = req.body;
    if (!questionText || !questionType) {
        return res.status(400).json({ error: "Texto e tipo da pergunta são obrigatórios." });
    }
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [questionResult]: any = await connection.execute(
            'INSERT INTO tournament_questions (tournamentId, questionText, questionType, isRequired) VALUES (?, ?, ?, ?)',
            [tournamentId, questionText, questionType, isRequired]
        );
        const newQuestionId = questionResult.insertId;
        if (questionType == 'MULTIPLE_CHOICE' && options && options.length > 0) {
            const optionValues = options.map((opt: string) => [newQuestionId, opt]);
            await connection.query('INSERT INTO question_options (questionId, optionText) VALUES ?', [optionValues]);
        }
        await connection.commit();
        res.status(201).json({ message: 'Pergunta criada com sucesso!', questionId: newQuestionId });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao criar pergunta:", error);
        res.status(500).json({ error: "Erro ao criar pergunta." });
    } finally {
        if (connection) connection.release();
    }
});

app.delete("/api/questions/:questionId", async (req: Request, res: Response) => {
    let connection;
    try {
        const { questionId } = req.params;
        connection = await pool.getConnection();
        await connection.execute('DELETE FROM tournament_questions WHERE id = ?', [questionId]);
        res.status(200).json({ message: 'Pergunta apagada com sucesso.' });
    } catch (error) {
        console.error("Error no apagar pergunta:", error);
        res.status(500).json({ error: "Error no apagar pergunta." });
    } finally {
        if (connection) connection.release();
    }
});

// -- ROTA FINAL CORRIGIDA --
app.get("/api/tournaments/:tournamentId/registrations-with-answers", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        // Buscar inscrições
        const [registrations]: any[] = await connection.execute(
            `SELECT r.id, r.paymentStatus, p.fullName
             FROM tournament_registrations r
             JOIN players p ON r.playerId = p.id
             WHERE r.tournamentId = ?
             ORDER BY p.fullName ASC`,
            [tournamentId]
        );
        // Buscar respostas
        for (const reg of registrations) {
            const [answers]: any[] = await connection.execute(
                `SELECT q.questionText, a.answer
                 FROM registration_answers a
                 JOIN tournament_questions q ON a.questionId = q.id
                 WHERE a.registrationId = ?
                 ORDER BY q.id ASC`,
                [reg.id]
            );
            reg.answers = answers;
        }
        res.json(registrations);
    } catch (error) {
        console.error("Error ao buscar inscrições com respostas:", error);
        res.status(500).json({ error: "Error ao buscar dados de inscrição." });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROTA PARA SALVAR PONTUAÇÕES ---
app.post("/api/scores/hole", async (req: Request, res: Response) => {
    const { groupId, holeNumber, scores } = req.body;
    if (!groupId || !holeNumber || !scores || !Array.isArray(scores)) {
        return res.status(400).json({ error: "Dados incompletos ou em formato inválido." });
    }
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        for (const score of scores) {
            if (score.strokes === null || score.strokes === undefined) continue;
            const query = `INSERT INTO scores (groupId, playerId, holeNumber, strokes)
                           VALUES (?, ?, ?, ?)
                           ON DUPLICATE KEY UPDATE strokes = ?`;
            await connection.execute(query, [groupId, score.playerId, holeNumber, score.strokes, score.strokes]);
        }
        await connection.commit();
        res.status(200).json({ message: "Pontuações do buraco salvas com sucesso." });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error as salvar pontuacoes do buraco:", error);
        res.status(500).json({ error: "Error no servidor as salvar pontuacoes." });
    } finally {
        if (connection) connection.release();
    }
});

// -- MIDDLEWARE PARA DEBUG --
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// === NOVAS ROTAS PARA CORRIGIR OS PROBLEMAS ===
// ROTA 1: Buscar jogadores confirmados para montar grupos
app.get("/api/tournaments/:tournamentId/confirmed-players", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [players] = await connection.execute(
            `SELECT r.id as registrationId, p.id as playerId, p.fullName, p.gender
             FROM tournament_registrations r
             JOIN players p ON r.playerId = p.id
             WHERE r.tournamentId = ? AND r.paymentStatus = 'confirmed'
             ORDER BY p.fullName ASC`,
            [tournamentId]
        );
        res.json(players);
    } catch (error) {
        console.error("Error as buscar jogadores confirmados:", error);
        res.status(500).json({ error: "Error as buscar jogadores." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA DE TESTE - ADICIONE ISSO
app.get('/api/teste-debug', async (req, res) => {
    console.log('✅ TESTE DEBUG - Esta mensagem DEVE aparecer no terminal!');
    res.json({ message: 'Teste OK - Verifique o terminal!' });
});

// === ROTA DE DEBUG TEMPORÁRIA (CORRIGIDA) ===
app.get("/api/debug/tournaments/:tournamentId/registrations", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    console.log('🔍 DEBUG: Tentando buscar inscrições para torneio:', tournamentId);
    
    let connection;
    try {
        console.log('🔍 DEBUG: Conectando ao banco...');
        connection = await pool.getConnection();
        console.log('✅ DEBUG: Conexão estabelecida');

        const query = `
            SELECT 
                tr.id,
                tr.playerId as player_id,
                tr.tournamentId as tournament_id, 
                tr.paymentStatus as payment_status,
                tr.registrationDate as registration_date,
                p.fullName,
                p.email
            FROM tournament_registrations tr
            INNER JOIN players p ON tr.playerId = p.id
            WHERE tr.tournamentId = ?
            ORDER BY tr.registrationDate DESC
        `;
        
        console.log('🔍 DEBUG: Executando query...');
        console.log('🔍 DEBUG: Com parâmetro tournamentId:', tournamentId);
        
        const [rows] = await connection.execute(query, [tournamentId]);
        console.log('✅ DEBUG: Query executada com sucesso');
        console.log('🔍 DEBUG: Resultados encontrados:', (rows as any[]).length);
        
        const formattedRegistrations = (rows as any[]).map(row => ({
            id: row.id,
            player_id: row.player_id,
            tournament_id: row.tournament_id,
            payment_status: row.payment_status,
            registration_date: row.registration_date,
            player: {
                fullName: row.fullName,
                email: row.email
            }
        }));
        
        console.log('✅ DEBUG: Retornando dados formatados');
        res.json(formattedRegistrations);
        
    } catch (error: any) {
        console.error('❌ DEBUG - ERRO COMPLETO:', error);
        console.error('❌ DEBUG - Mensagem:', error.message);
        res.status(500).json({ 
            error: 'Erro ao buscar inscritos.',
            debug: {
                message: error.message,
                sqlMessage: error.sqlMessage,
                code: error.code
            }
        });
    } finally {
        if (connection) {
            console.log('🔍 DEBUG: Liberando conexão');
            connection.release();
        }
    }
});
app.listen(port, () => {
    console.log(`✅ Servidor backend rodando em http://localhost:${port}`);
});