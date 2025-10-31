import nodemailer from "nodemailer";
import crypto from "crypto";
import express, { Request, Response, NextFunction } from "express"; // Importar NextFunction
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import multer from "multer";
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import bcrypt from "bcrypt";

// DEFINIR O FUSO HORÁRIO GLOBAL PARA O SERVIDOR
process.env.TZ = 'America/Sao_Paulo'; 

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage: storage });

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    timezone: "-03:00" // Garantir que o MySQL usa o fuso de Brasília
};
const pool = mysql.createPool(dbConfig);

// --- INTERFACES ---
interface ScoreQueryResult { 
    playerId: number;
    holeNumber: number;
    strokes: number | null;
}
interface PlayerQueryResult {
    id: number;
    playerId: number; 
    fullName: string;
    gender: 'Male' | 'Female';
    courseHandicap?: number;
    categoryName?: string; 
}
interface TeeData {
    id: number;
    holeId: number;
    color: string;
    yardage: number;
}
interface HoleQueryResult {
    id: number;
    holeNumber: number;
    par: number;
    aerialImageUrl?: string | null;
    tees: TeeData[]; 
}
interface ScorecardPlayer {
    id: number; 
    playerId: number; 
    fullName: string;
    gender: 'Male' | 'Female';
    courseHandicap?: number;
    totalStrokes?: number;
    netScore?: number;
    tieBreakReason?: string;
    scores: { holeNumber: number; strokes: number | null }[];
    tieBreakScores: { last9: number; last6: number; last3: number; last1: number };
    parThrough?: number;
    toParGross?: number;
    netToPar?: number;
    through?: number;
    categoryName?: string;
}
interface HoleWithTees {
    id: number;
    holeNumber: number;
    par: number;
    tees: TeeData[]; 
}
interface CourseForScorecard {
    holes: HoleWithTees[];
    courseName?: string; 
    date?: string; 
}
interface TrainingLeaderboardPlayer {
    playerId: number;
    fullName: string;
    gender: 'Male' | 'Female';
    totalStrokes: number;
    through: number;
    toParGross: number;
}

// ===================================================================
// INÍCIO DO BLOCO DE TREINO (Corrigido e Melhorado)
// ===================================================================

app.post("/api/trainings", async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, creatorId, date, startHole, type = 'single_group' } = req.body;
    let connection;
    try {
        // CORREÇÃO: Converter IDs para números
        const numericCourseId = parseInt(courseId, 10);
        const numericCreatorId = parseInt(creatorId, 10);
        const numericStartHole = parseInt(startHole, 10);

        if (isNaN(numericCourseId) || isNaN(numericCreatorId) || isNaN(numericStartHole)) {
            return res.status(400).json({ error: "IDs inválidos ou em falta." });
        }
        
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const initialStatus = type === 'multi_group' ? 'awaiting_groups' : 'active';
        
        const [trainingResult]: any = await connection.execute(
            "INSERT INTO trainings (courseId, creatorId, date, status, type) VALUES (?, ?, ?, ?, ?)",
            [numericCourseId, numericCreatorId, date, initialStatus, type]
        );
        const trainingId = trainingResult.insertId;

        const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const [groupResult]: any = await connection.execute(
            "INSERT INTO training_groups (trainingId, startHole, accessCode) VALUES (?, ?, ?)",
            [trainingId, numericStartHole, accessCode]
        );
        const trainingGroupId = groupResult.insertId;

        await connection.execute(
            "INSERT INTO training_participants (trainingGroupId, playerId, isResponsible, invitationStatus) VALUES (?, ?, ?, 'accepted')",
            [trainingGroupId, numericCreatorId, 1]
        );

        await connection.commit();
        const [courseInfo]: any[] = await connection.execute("SELECT name FROM courses WHERE id = ?", [numericCourseId]);
        res.status(201).json({
            id: trainingId, trainingGroupId, accessCode, date,
            courseName: courseInfo.length > 0 ? courseInfo[0].name : 'Campo Desconhecido',
            creatorId: numericCreatorId,
            status: initialStatus, type
        });
    } catch (error: any) {
         if (connection) await connection.rollback();
         console.error("Erro ao criar treino:", error);
         const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
         res.status(500).json({ error: errorMessage });
    } finally {
         if (connection) connection.release();
    }
});

app.post("/api/trainings/:trainingId/groups", async (req: Request, res: Response, next: NextFunction) => {
    const { trainingId } = req.params;
    const { startHole, players, responsiblePlayerId } = req.body; 

    let connection;
    try {
        if (!startHole || !Array.isArray(players) || players.length === 0 || !responsiblePlayerId) {
            return res.status(400).json({ error: "Dados inválidos para criar novo grupo." });
        }
        
        // CORREÇÃO: Converter IDs para números
        const numericTrainingId = parseInt(trainingId, 10);
        const numericStartHole = parseInt(startHole, 10);
        const numericResponsiblePlayerId = parseInt(responsiblePlayerId, 10);

        if (!players.find(p => parseInt(p.id, 10) === numericResponsiblePlayerId)) {
            return res.status(400).json({ error: "O jogador responsável deve estar na lista de jogadores." });
        }

        connection = await pool.getConnection();
        const [trainingRows]: any = await connection.execute("SELECT id, type FROM trainings WHERE id = ?", [numericTrainingId]);
        if (trainingRows.length === 0) {
            return res.status(404).json({ error: "Jogo de Aposta principal não encontrado." });
        }
        if (trainingRows[0].type !== 'multi_group') { // Garantir que só se adiciona grupos a Jogos de Aposta
            return res.status(400).json({ error: "Este treino não permite múltiplos grupos." });
        }

        await connection.beginTransaction();

        const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const [groupResult]: any = await connection.execute(
            "INSERT INTO training_groups (trainingId, startHole, accessCode) VALUES (?, ?, ?)",
            [numericTrainingId, numericStartHole, accessCode]
        );
        const newGroupId = groupResult.insertId;

        const participantValues = players.map((player: { id: string | number }) => [
            newGroupId,
            parseInt(player.id as string, 10), // Converter ID do jogador
            parseInt(player.id as string, 10) === numericResponsiblePlayerId ? 1 : 0, 
            'accepted' 
        ]);
        await connection.query(
            "INSERT INTO training_participants (trainingGroupId, playerId, isResponsible, invitationStatus) VALUES ?",
            [participantValues]
        );

        await connection.commit();
        res.status(201).json({
            message: "Novo grupo adicionado ao Jogo de Aposta!",
            trainingGroupId: newGroupId,
            accessCode: accessCode 
        });

    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("Erro ao adicionar grupo ao treino:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/trainings/:trainingId/leaderboard", async (req: Request, res: Response, next: NextFunction) => {
    const { trainingId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [trainingInfo]: any[] = await connection.execute(
            `SELECT t.id, t.date, c.name as courseName, c.id as courseId, t.type
             FROM trainings t
             JOIN courses c ON t.courseId = c.id
             WHERE t.id = ?`, [trainingId]
        );
        if (trainingInfo.length === 0) return res.status(404).json({ error: "Treino não encontrado." });
        
        const { courseId, courseName } = trainingInfo[0];
        const [holesResult]: any[] = await connection.execute("SELECT holeNumber, par FROM holes WHERE courseId = ? ORDER BY holeNumber", [courseId]);
        const parMap = new Map(holesResult.map((h: { holeNumber: number, par: number }) => [h.holeNumber, h.par]));
        const [groups]: any[] = await connection.execute("SELECT id FROM training_groups WHERE trainingId = ?", [trainingId]);
        if (groups.length === 0) return res.json({ trainingName: `Jogo em ${courseName}`, leaderboard: [] });
        
        const groupIds = groups.map((g: { id: number }) => g.id);
        
        interface ParticipantInfo { playerId: number; fullName: string; gender: 'Male' | 'Female'; }
        const [participants]: any[] = await connection.execute(
            `SELECT DISTINCT p.id as playerId, p.fullName, p.gender
             FROM training_participants tp
             JOIN players p ON tp.playerId = p.id
             WHERE tp.trainingGroupId IN (?) AND tp.invitationStatus = 'accepted'`, [groupIds]
        );

        const [allScoresResult]: any[] = await connection.execute(`SELECT playerId, holeNumber, strokes FROM training_scores WHERE trainingGroupId IN (?)`, [groupIds]);
        const allScores: ScoreQueryResult[] = allScoresResult as ScoreQueryResult[];

        const leaderboardData: TrainingLeaderboardPlayer[] = participants.map((player: ParticipantInfo): TrainingLeaderboardPlayer => {
            const playerScores = allScores.filter(s => s.playerId === player.playerId);
            const totalStrokes = playerScores.reduce((sum, s) => sum + (s.strokes || 0), 0);
            let parThrough = 0;
            playerScores.forEach(s => { parThrough += Number(parMap.get(s.holeNumber) ?? 0); });
            const holesPlayed = playerScores.filter(s => s.strokes !== null).length;

            return {
                playerId: player.playerId,
                fullName: player.fullName,
                gender: player.gender, 
                totalStrokes,
                through: holesPlayed,
                toParGross: totalStrokes - parThrough,
            };
        });

        leaderboardData.sort((a, b) => {
            const scoreDiff = a.totalStrokes - b.totalStrokes;
            if (scoreDiff !== 0) return scoreDiff;
            return a.fullName.localeCompare(b.fullName);
        });

        res.json({
            trainingName: `Jogo em ${courseName}`,
            leaderboard: leaderboardData
        });

    } catch (error: any) {
        console.error("Erro ao gerar leaderboard de treino:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.delete("/api/trainings/:trainingId/creator/:creatorId", async (req: Request, res: Response, next: NextFunction) => {
    const { trainingId, creatorId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [trainingRows]: any[] = await connection.execute( "SELECT creatorId FROM trainings WHERE id = ?", [trainingId] );
        if (trainingRows.length === 0 || trainingRows[0].creatorId.toString() !== creatorId) {
            return res.status(403).json({ error: "Apenas o criador pode apagar o treino." });
        }
        await connection.beginTransaction();
        const [groups]: any[] = await connection.execute("SELECT id FROM training_groups WHERE trainingId = ?", [trainingId]);
        if (groups.length > 0) {
            const groupIds = groups.map((g: any) => g.id);
            await connection.query("DELETE FROM training_scores WHERE trainingGroupId IN (?)", [groupIds]);
            await connection.query("DELETE FROM training_participants WHERE trainingGroupId IN (?)", [groupIds]);
            await connection.query("DELETE FROM training_groups WHERE trainingId = ?", [trainingId]);
        }
        await connection.execute("DELETE FROM trainings WHERE id = ?", [trainingId]);
        await connection.commit();
        res.status(200).json({ message: "Treino apagado com sucesso." });
    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("Erro ao apagar treino:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/users/:userId/trainings", async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        // Esta rota agora busca AMBOS os tipos de treino ativos (single_group e multi_group)
        const [trainings] = await connection.execute(
            `SELECT t.id, t.date, t.status, c.name as courseName, tg.accessCode, t.creatorId, tg.id as trainingGroupId, t.type
             FROM trainings t
             JOIN courses c ON t.courseId = c.id
             JOIN training_groups tg ON t.id = tg.trainingId
             JOIN training_participants tp ON tg.id = tp.trainingGroupId
             WHERE tp.playerId = ? AND tp.invitationStatus = 'accepted' AND (t.status = 'active' OR t.status = 'awaiting_groups')
             ORDER BY t.date DESC`, [userId]
        );
        res.json(trainings);
    } catch (error: any) {
        console.error("Erro ao buscar treinos ativos:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA MODIFICADA (Lógica #4)
app.get("/api/history/player/:playerId", async (req: Request, res: Response, next: NextFunction) => {
    const { playerId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();

        // Esta rota AGORA SÓ RETORNA TREINOS (single_group e multi_group)
        const [trainings]: any[] = await connection.execute(
            `SELECT
                t.id,
                CASE 
                    WHEN t.type = 'multi_group' THEN 'Jogo de Aposta'
                    ELSE 'Treino em Grupo'
                END as name,
                t.date,
                t.finishedAt,
                c.name as courseName,
                t.type,
                tg.id as groupId 
             FROM trainings t
             JOIN courses c ON t.courseId = c.id
             JOIN training_groups tg ON t.id = tg.trainingId
             WHERE
                t.status = 'completed'
                AND EXISTS (
                    SELECT 1
                    FROM training_participants tp
                    WHERE tp.trainingGroupId = tg.id AND tp.playerId = ?
                )
             GROUP BY t.id, tg.id -- Agrupar para evitar duplicatas se um jogador estiver em múltiplos grupos do mesmo treino (embora a lógica atual não suporte isso)
             ORDER BY t.finishedAt DESC`,
            [playerId]
        );

        // A query de torneios foi REMOVIDA daqui
        
        res.json(trainings);
    } catch (error: any) {
        console.error("Erro ao buscar histórico de treinos:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});


app.get("/api/trainings/groups/:groupId/participants", async (req: Request, res: Response, next: NextFunction) => {
    const { groupId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [participants] = await connection.execute(
            `SELECT p.id, p.fullName, p.email, tp.invitationStatus
             FROM training_participants tp
             JOIN players p ON tp.playerId = p.id
             WHERE tp.trainingGroupId = ?
             ORDER BY p.fullName`, [groupId] );
        res.json(participants);
    } catch (error: any) {
        console.error("Erro ao buscar participantes do treino:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

// Rota antiga de exportação individual de treino
app.get("/api/trainings/:trainingGroupId/export/:playerId", async (req: Request, res: Response, next: NextFunction) => {
     let connection;
    try {
        const { trainingGroupId, playerId } = req.params;
        connection = await pool.getConnection();
        // ... (código original mantido para compatibilidade, mas a nova rota /api/export/scorecard/... é melhor)
        const [playerInfo]: any[] = await connection.execute("SELECT fullName FROM players WHERE id = ?", [playerId]);
        const [trainingInfo]: any[] = await connection.execute(
            `SELECT t.date, c.name as courseName FROM trainings t
             JOIN training_groups tg ON t.id = tg.trainingId
             JOIN courses c ON t.courseId = c.id
             WHERE tg.id = ?`, [trainingGroupId]
        );
        const [scores]: any[] = await connection.execute(
            `SELECT ts.holeNumber, ts.strokes, h.par, tee.yardage
             FROM training_scores ts
             JOIN training_groups tg ON ts.trainingGroupId = tg.id
             JOIN trainings t ON tg.trainingId = t.id
             JOIN holes h ON t.courseId = h.courseId AND ts.holeNumber = h.holeNumber
             LEFT JOIN training_participants tp ON ts.playerId = tp.playerId AND ts.trainingGroupId = tp.trainingGroupId
             LEFT JOIN tees tee ON h.id = tee.holeId AND tp.teeColor = tee.color
             WHERE ts.trainingGroupId = ? AND ts.playerId = ?
             ORDER BY ts.holeNumber`, [trainingGroupId, playerId] );
        if (!playerInfo.length || !trainingInfo.length) return res.status(404).send("Dados não encontrados.");
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Cartão de Treino');
        sheet.mergeCells('A1:D1');
        sheet.getCell('A1').value = `Cartão de Treino - ${playerInfo[0].fullName}`;
        sheet.getCell('A1').font = { size: 16, bold: true };
        sheet.addRow([]);
        sheet.addRow(['Campo', trainingInfo[0].courseName]);
        sheet.addRow(['Data', new Date(trainingInfo[0].date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})]);
        sheet.addRow([]);
        const headerRow = sheet.addRow(['Buraco', 'Distância', 'Par', 'Score']);
        headerRow.font = { bold: true };
        let totalStrokes = 0;
        if (Array.isArray(scores)) {
            scores.forEach((score: any) => {
                sheet.addRow([score.holeNumber, score.yardage ? `${score.yardage}m` : '-', score.par, score.strokes]);
                totalStrokes += score.strokes || 0;
            });
        }
        sheet.addRow([]);
        const totalRow = sheet.addRow(['Total', '', '', totalStrokes]);
        totalRow.font = { bold: true };
        sheet.columns.forEach((column: any) => { column.width = 15; });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Cartao_Treino_${playerInfo[0].fullName.replace(/\s+/g, '_')}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error: any) {
        console.error("Erro ao exportar cartão:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

// Rota antiga de exportação de grupo de treino
app.get("/api/trainings/export/grupo/:groupId", async (req: Request, res: Response, next: NextFunction) => {
    const { groupId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [trainingInfo]: any[] = await connection.execute(
            `SELECT t.date, c.name as courseName, c.id as courseId
             FROM trainings t
             JOIN training_groups tg ON t.id = tg.trainingId
             JOIN courses c ON t.courseId = c.id
             WHERE tg.id = ?`, [groupId] );
        if (trainingInfo.length === 0) return res.status(404).send('Grupo de treino não encontrado.');
        
        const [playersResult]: any[] = await connection.execute(
            `SELECT p.id, p.fullName
             FROM players p
             JOIN training_participants tp ON p.id = tp.playerId
             WHERE tp.trainingGroupId = ? AND tp.invitationStatus = 'accepted'`, [groupId] );
        const players: PlayerQueryResult[] = playersResult as PlayerQueryResult[]; 
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Resultados do Grupo');
        sheet.mergeCells('A1:D1');
        sheet.getCell('A1').value = `Resultado do Grupo - ${trainingInfo[0].courseName}`;
        sheet.getCell('A1').font = { size: 16, bold: true };
        sheet.addRow(['Data', new Date(trainingInfo[0].date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})]);
        sheet.addRow([]);
        const headers = ['Buraco', 'Par'];
        players.forEach((p: { id: number; fullName: string }) => headers.push(p.fullName));
        sheet.addRow(headers).font = { bold: true };
        const [holesResult]: any[] = await connection.execute('SELECT holeNumber, par FROM holes WHERE courseId = ? ORDER BY holeNumber', [trainingInfo[0].courseId]);
        const holes: { holeNumber: number; par: number }[] = holesResult as { holeNumber: number; par: number }[];
        const totals: Record<string, number> = {};
        players.forEach((p: { id: number; fullName: string }) => totals[p.id] = 0);
        for (const hole of holes) {
            const rowData: (string | number)[] = [hole.holeNumber, hole.par];
            for (const player of players) {
                const [scoreResult]: any[] = await connection.execute(
                    `SELECT strokes FROM training_scores WHERE trainingGroupId = ? AND playerId = ? AND holeNumber = ?`,
                    [groupId, player.id, hole.holeNumber] );
                const strokes = scoreResult[0]?.strokes ?? 0;
                rowData.push(strokes);
                totals[player.id] += strokes;
            }
            sheet.addRow(rowData);
        }
        const totalRow: (string | number)[] = ['Total', ''];
        players.forEach((p: { id: number; fullName: string }) => totalRow.push(totals[p.id]));
        sheet.addRow(totalRow).font = { bold: true };
        sheet.columns.forEach(column => { /* ... ajuste largura ... */ });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=resultado_grupo_${groupId}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error: any) {
        console.error("Erro ao exportar resultado do grupo de treino:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

// ===================================================================
// FIM DO BLOCO DE TREINO
// ===================================================================

app.get("/api/courses/public", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute("SELECT id, name FROM courses ORDER BY name ASC");
        res.json(rows);
    } catch (error: any) {
        console.error("Erro ao buscar campos públicos:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments/:tournamentId/confirmed-players", async (req: Request, res: Response, next: NextFunction) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [players] = await connection.execute(
            `SELECT p.id as playerId, p.fullName, p.gender, tr.id as registrationId
             FROM tournament_registrations tr
             JOIN players p ON tr.playerId = p.id
             WHERE tr.tournamentId = ? AND tr.paymentStatus = 'confirmed'
             ORDER BY p.fullName ASC`, [tournamentId] );
        res.json(players);
    } catch (error: any) {
        console.error("Erro ao buscar jogadores confirmados:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments/:tournamentId/leaderboard", async (req: Request, res: Response, next: NextFunction) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [tournamentInfo]: any[] = await connection.execute("SELECT name FROM tournaments WHERE id = ?", [tournamentId]);
        if (tournamentInfo.length === 0) { return res.status(404).json({ error: "Torneio não encontrado." }); }

        const [holesResult]: any[] = await connection.execute(
            `SELECT h.holeNumber, h.par FROM holes h JOIN courses c ON h.courseId = c.id JOIN tournaments t ON c.id = t.courseId WHERE t.id = ?`,
            [tournamentId]
        );
        const parMap = new Map(holesResult.map((h: { holeNumber: number; par: number }) => [h.holeNumber, h.par]));

        const [playerDataResult]: any[] = await connection.execute(
            `SELECT p.id as playerId, p.fullName, p.gender, gp.courseHandicap, tcat.name as categoryName
             FROM players p JOIN group_players gp ON p.id = gp.playerId JOIN \`groups\` g ON gp.groupId = g.id
             LEFT JOIN tournament_registrations tr ON tr.playerId = p.id AND tr.tournamentId = g.tournamentId
             LEFT JOIN tournament_categories tcat ON tr.categoryId = tcat.id WHERE g.tournamentId = ?`,
            [tournamentId]
        );
         const playerData: PlayerQueryResult[] = playerDataResult as PlayerQueryResult[]; 

        const [allScoresResult]: any[] = await connection.execute(
            `SELECT s.playerId, s.holeNumber, s.strokes FROM scores s JOIN \`groups\` g ON s.groupId = g.id WHERE g.tournamentId = ?`,
            [tournamentId]
        );
        const allScores: ScoreQueryResult[] = allScoresResult as ScoreQueryResult[]; 

        const leaderboardData = playerData.map((player: PlayerQueryResult) => {
            const playerScores = allScores.filter((s: ScoreQueryResult) => s.playerId === player.playerId);
            const totalStrokes = playerScores.reduce((sum: number, s: ScoreQueryResult) => sum + (s.strokes || 0), 0);
            const netScore = totalStrokes - (player.courseHandicap || 0);
            let parThrough = 0;
            playerScores.forEach((s: ScoreQueryResult) => {
                parThrough += Number(parMap.get(s.holeNumber) ?? 0);
            });
            const leaderboardPlayer : Partial<ScorecardPlayer> = {
                ...player,
                playerId: player.playerId, 
                id: player.playerId, 
                totalStrokes,
                netScore,
                through: playerScores.length,
                parThrough,
                toParGross: totalStrokes - parThrough,
                netToPar: netScore - parThrough,
                scores: playerScores 
             };
            return leaderboardPlayer;
        });

        res.json({ tournamentName: tournamentInfo[0].name, leaderboard: leaderboardData });
    } catch (error: any) {
        console.error("Erro ao gerar leaderboard:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

const scorecardStyler = {
    headerFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } } as ExcelJS.FillPattern,
    headerFont: { color: { argb: 'FF34D399' }, bold: true, size: 12 },
    titleFont: { color: { argb: 'FF000000' }, bold: true, size: 16 },
    subtitleFont: { color: { argb: 'FF000000' }, size: 11 },
    parFont: { bold: true, color: { argb: 'FF34D399' } },
    playerFont: { bold: true, size: 11 },
    totalsFont: { bold: true, color: { argb: 'FF34D399' } },
    borderStyle: { style: 'thin', color: { argb: 'FF4B5563' } } as ExcelJS.Border,
    applyBorders: (cell: ExcelJS.Cell) => {
        cell.border = { top: scorecardStyler.borderStyle, left: scorecardStyler.borderStyle, bottom: scorecardStyler.borderStyle, right: scorecardStyler.borderStyle };
    },
    teeColors: {
        BLUE: { argb: 'FF0000FF' }, GOLD: { argb: 'FFFFD700' }, RED: { argb: 'FFFF0000' }, WHITE: { argb: 'FF000000' }
    } as Record<string, Partial<ExcelJS.Color>>
};

const buildHorizontalScorecard = async (sheet: ExcelJS.Worksheet, title: string, subtitle: string, courseData: CourseForScorecard, playersData: ScorecardPlayer[]) => {
     sheet.mergeCells('A1:Z1'); sheet.getCell('A1').value = title; sheet.getCell('A1').font = scorecardStyler.titleFont; sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
     sheet.mergeCells('A2:Z2'); sheet.getCell('A2').value = subtitle; sheet.getCell('A2').font = scorecardStyler.subtitleFont; sheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' }; sheet.addRow([]);
     const headers_campo = ['HOLE', null, ...Array.from({ length: 9 }, (_, i) => i + 1), 'OUT', ...Array.from({ length: 9 }, (_, i) => i + 10), 'IN', 'TOTAL'];
     const holeRow = sheet.addRow(headers_campo); holeRow.font = scorecardStyler.headerFont; holeRow.getCell(1).value = 'HOLE'; holeRow.eachCell((cell, colNumber) => { if (colNumber >= 3) scorecardStyler.applyBorders(cell); cell.alignment = { horizontal: 'center' }; });
     const parData = ['PAR', null, ...courseData.holes.slice(0, 9).map(h => h.par), null, ...courseData.holes.slice(9, 18).map(h => h.par), null, null];
     const parRow = sheet.addRow(parData); parRow.font = scorecardStyler.parFont; parRow.getCell(1).value = 'PAR'; parRow.eachCell((cell, colNumber) => { if (colNumber >= 3) scorecardStyler.applyBorders(cell); cell.alignment = { horizontal: 'center' }; });
     parRow.getCell(12).value = { formula: `SUM(C${parRow.number}:K${parRow.number})` }; parRow.getCell(22).value = { formula: `SUM(M${parRow.number}:U${parRow.number})` }; parRow.getCell(23).value = { formula: `L${parRow.number}+V${parRow.number}` };
     const teeColorsSet = new Set(courseData.holes.flatMap((h: HoleWithTees) => h.tees.map((t: TeeData) => t.color.toUpperCase()))); const teeColors = Array.from(teeColorsSet).sort();
     let currentTeeRowNumber = parRow.number + 1;
     teeColors.forEach(color => {
         const yardages = courseData.holes.map((h: HoleWithTees) => h.tees.find((t: TeeData) => t.color.toUpperCase() === color)?.yardage ?? '-');
         const teeRowData = [color, null, ...yardages.slice(0, 9), null, ...yardages.slice(9, 18), null, null]; const teeRow = sheet.addRow(teeRowData); const teeNameCell = teeRow.getCell(1); teeNameCell.value = color; const teeColorStyle = scorecardStyler.teeColors[color];
         teeRow.eachCell((cell, colNumber) => { if (colNumber >= 3) { scorecardStyler.applyBorders(cell); cell.alignment = { horizontal: 'center' }; if (teeColorStyle) cell.font = { color: teeColorStyle }; } });
         if (teeColorStyle) { teeNameCell.font = { bold: true, color: teeColorStyle }; } else { teeNameCell.font = { bold: true }; } teeNameCell.alignment = { horizontal: 'left', vertical: 'middle' };
         teeRow.getCell(12).value = { formula: `SUM(C${teeRow.number}:K${teeRow.number})` }; teeRow.getCell(22).value = { formula: `SUM(M${teeRow.number}:U${teeRow.number})` }; teeRow.getCell(23).value = { formula: `L${teeRow.number}+V${teeRow.number}` }; currentTeeRowNumber++;
     });
     sheet.addRow([]);
     const headers_jogadores = ['Pos.', 'Nome', 'HDC', ...Array.from({ length: 9 }, (_, i) => i + 1), 'OUT', ...Array.from({ length: 9 }, (_, i) => i + 10), 'IN', 'GROSS', 'NET', 'Desempate'];
     const headerPlayerRow = sheet.addRow(headers_jogadores); headerPlayerRow.eachCell((cell, colNumber) => { cell.font = scorecardStyler.headerFont; cell.fill = scorecardStyler.headerFill; scorecardStyler.applyBorders(cell); cell.alignment = { horizontal: 'center' }; }); headerPlayerRow.getCell(2).alignment = { horizontal: 'left' };
     playersData.forEach((player, index) => {
         const scores = Array(18).fill(null); player.scores.forEach(s => { if (s.holeNumber >= 1 && s.holeNumber <= 18) { scores[s.holeNumber - 1] = s.strokes; } });
         const scoreRowData = [ index + 1, player.fullName, player.courseHandicap ?? '-', ...scores.slice(0, 9), null, ...scores.slice(9, 18), null, null, null, player.tieBreakReason || '' ];
         const scoreRow = sheet.addRow(scoreRowData); scoreRow.getCell(2).font = scorecardStyler.playerFont; scoreRow.getCell(2).alignment = { horizontal: 'left' };
         scoreRow.eachCell((cell, colNumber) => { scorecardStyler.applyBorders(cell); if (![2, 26].includes(colNumber)) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; } else { cell.alignment = { horizontal: 'left', vertical: 'middle' }; } });
         const outCell = scoreRow.getCell(13); const inCell = scoreRow.getCell(23); const grossCell = scoreRow.getCell(24); const netCell = scoreRow.getCell(25);
         outCell.value = { formula: `SUM(D${scoreRow.number}:L${scoreRow.number})` }; inCell.value = { formula: `SUM(N${scoreRow.number}:V${scoreRow.number})` }; grossCell.value = { formula: `M${scoreRow.number}+W${scoreRow.number}` };
         if (player.courseHandicap !== null && player.courseHandicap !== undefined && typeof player.courseHandicap === 'number') { netCell.value = { formula: `X${scoreRow.number}-C${scoreRow.number}` }; } else { netCell.value = '-'; }
         [outCell, inCell, grossCell, netCell].forEach(cell => { cell.font = scorecardStyler.totalsFont; cell.alignment = { horizontal: 'center' }; }); const tieBreakCell = scoreRow.getCell(26); scorecardStyler.applyBorders(tieBreakCell); tieBreakCell.alignment = { horizontal: 'left', vertical: 'middle' };
     });
     sheet.getColumn('A').width = 6; sheet.getColumn('B').width = 35; sheet.getColumn('C').width = 5; for (let i = 4; i <= 11; i++) { sheet.getColumn(i).width = 4.5; } sheet.getColumn(12).width = 6; for (let i = 13; i <= 21; i++) { sheet.getColumn(i).width = 4.5; } sheet.getColumn(22).width = 6; sheet.getColumn(23).width = 7; sheet.getColumn(24).width = 7; sheet.getColumn(25).width = 5; sheet.getColumn(26).width = 15;
};

const buildGrossChampionsSheet = (sheet: ExcelJS.Worksheet, players: ScorecardPlayer[]) => {
    sheet.addRow(['Campeões Gross']).font = { size: 16, bold: true }; sheet.mergeCells('A1:C1'); sheet.getRow(1).alignment = { horizontal: 'center' }; sheet.addRow([]);
    const headers = ['Pos.', 'Nome', 'GROSS']; const headerRow = sheet.addRow(headers);
    headerRow.eachCell(cell => {
        cell.font = scorecardStyler.headerFont;
        cell.fill = scorecardStyler.headerFill;
        scorecardStyler.applyBorders(cell);
        cell.alignment = { horizontal: 'center' };
    });
    const sortedPlayers = [...players].sort((a, b) => (a.totalStrokes || 999) - (b.totalStrokes || 999));
    sortedPlayers.forEach((player, index) => {
        const row = sheet.addRow([index + 1, player.fullName, player.totalStrokes]); row.getCell(2).font = scorecardStyler.playerFont;
        row.eachCell(cell => {
             scorecardStyler.applyBorders(cell);
            cell.alignment = { horizontal: 'center' };
        });
        row.getCell(2).alignment = { horizontal: 'left' };
    });
    sheet.getColumn('B').width = 35; sheet.getColumn('A').width = 6; sheet.getColumn('C').width = 8;
};

const categorizePlayer = (player: { gender: 'Male' | 'Female', courseHandicap?: number }): string => {
    const hcp = player.courseHandicap ?? 99; 
    if (player.gender === 'Male') {
        if (hcp <= 8.5) return 'M1'; if (hcp <= 14.0) return 'M2'; if (hcp <= 22.2) return 'M3'; return 'M4';
    } else {
        if (hcp <= 13.1) return 'F1'; if (hcp <= 21.2) return 'F2'; if (hcp <= 28.3) return 'F3'; return 'F4';
    }
};

app.get("/api/export/scorecard/tournament/:tournamentId", async (req: Request, res: Response, next: NextFunction) => {
     const { tournamentId } = req.params; let connection;
    try {
        connection = await pool.getConnection();
        const [tournamentInfo]: any[] = await connection.execute( "SELECT t.name, t.date, c.name as courseName, t.courseId FROM tournaments t JOIN courses c ON t.courseId = c.id WHERE t.id = ?", [tournamentId] );
        if (!tournamentInfo.length) return res.status(404).send('Torneio não encontrado.');
        const { name: tournamentName, date: tournamentDate, courseName, courseId } = tournamentInfo[0];
        const [holesResult]: any[] = await connection.execute( `SELECT id, holeNumber, par FROM holes WHERE courseId = ? ORDER BY holeNumber ASC`, [courseId] );
        const holes: HoleQueryResult[] = holesResult as HoleQueryResult[];
        for (const hole of holes) { const [tees] = await connection.execute("SELECT * FROM tees WHERE holeId = ?", [hole.id]); hole.tees = tees as TeeData[] ?? []; }
        const courseData: CourseForScorecard = { holes, courseName, date: tournamentDate }; 
        const [playerDataResult]: any[] = await connection.execute( `SELECT p.id as playerId, p.fullName, p.gender, gp.courseHandicap, tcat.name as categoryName FROM players p JOIN group_players gp ON p.id = gp.playerId JOIN \`groups\` g ON gp.groupId = g.id LEFT JOIN tournament_registrations tr ON tr.playerId = p.id AND tr.tournamentId = g.tournamentId LEFT JOIN tournament_categories tcat ON tr.categoryId = tcat.id WHERE g.tournamentId = ?`, [tournamentId] );
         const playerData: PlayerQueryResult[] = playerDataResult as PlayerQueryResult[];
        const [allScoresResult]: any[] = await connection.execute( `SELECT s.playerId, s.holeNumber, s.strokes FROM scores s JOIN \`groups\` g ON s.groupId = g.id WHERE g.tournamentId = ?`, [tournamentId] );
         const allScores: ScoreQueryResult[] = allScoresResult as ScoreQueryResult[];
        const playersWithScores: ScorecardPlayer[] = [];
        for (const p of playerData) {
            const playerScores = allScores.filter((s: ScoreQueryResult) => s.playerId === p.playerId);
            const totalStrokes = playerScores.reduce((sum: number, s: ScoreQueryResult) => sum + (s.strokes || 0), 0);
            const netScore = totalStrokes - (p.courseHandicap ?? 0);
            const calculateNetTieBreak = (start: number, count: number) => {
                 const relevantScores = playerScores.filter((s: ScoreQueryResult) => s.holeNumber >= start && s.holeNumber < start + count);
                 const grossSum = relevantScores.reduce((sum: number, s: ScoreQueryResult) => sum + (s.strokes || 0), 0);
                 const hcpProportional = (p.courseHandicap ?? 0) * (count / 18.0); return grossSum - hcpProportional;
            };
            const tieBreakScores = { last9: calculateNetTieBreak(10, 9), last6: calculateNetTieBreak(13, 6), last3: calculateNetTieBreak(16, 3), last1: (playerScores.find((s: ScoreQueryResult) => s.holeNumber === 18)?.strokes || 0) - ((p.courseHandicap ?? 0) / 18.0) };
             playersWithScores.push({ ...p, id: p.playerId, scores: playerScores.map(s => ({holeNumber: s.holeNumber, strokes: s.strokes})), totalStrokes, netScore, tieBreakScores });
        }
        const tiebreakSort = (a: ScorecardPlayer, b: ScorecardPlayer): number => {
            const netDiff = (a.netScore ?? 999) - (b.netScore ?? 999); if (netDiff !== 0) return netDiff;
            const hcpDiff = (a.courseHandicap ?? 99) - (b.courseHandicap ?? 99); if (hcpDiff !== 0) { a.tieBreakReason = 'Desempate: Menor HDC'; b.tieBreakReason = 'Desempate: Menor HDC'; return hcpDiff; }
            const last9Diff = a.tieBreakScores.last9 - b.tieBreakScores.last9; if (last9Diff !== 0) { a.tieBreakReason = 'Desempate: Últimos 9 NET'; b.tieBreakReason = 'Desempate: Últimos 9 NET'; return last9Diff; }
            const last6Diff = a.tieBreakScores.last6 - b.tieBreakScores.last6; if (last6Diff !== 0) { a.tieBreakReason = 'Desempate: Últimos 6 NET'; b.tieBreakReason = 'Desempate: Últimos 6 NET'; return last6Diff; }
            const last3Diff = a.tieBreakScores.last3 - b.tieBreakScores.last3; if (last3Diff !== 0) { a.tieBreakReason = 'Desempate: Últimos 3 NET'; b.tieBreakReason = 'Desempate: Últimos 3 NET'; return last3Diff; }
            const last1Diff = a.tieBreakScores.last1 - b.tieBreakScores.last1; if (last1Diff !== 0) { a.tieBreakReason = 'Desempate: Último Buraco NET'; b.tieBreakReason = 'Desempate: Último Buraco NET'; return last1Diff; }
            a.tieBreakReason = 'Desempate: Sorteio'; b.tieBreakReason = 'Desempate: Sorteio'; return a.playerId - b.playerId;
        };
        const categorizedData: { Male: Record<string, ScorecardPlayer[]>, Female: Record<string, ScorecardPlayer[]>} = { Male: { M1: [], M2: [], M3: [], M4: [] }, Female: { F1: [], F2: [], F3: [], F4: [] } };
        const allMalePlayers: ScorecardPlayer[] = []; const allFemalePlayers: ScorecardPlayer[] = [];
        playersWithScores.forEach(player => {
            const category = categorizePlayer({ gender: player.gender, courseHandicap: player.courseHandicap });
            if (player.gender === 'Male') { categorizedData.Male[category].push(player); allMalePlayers.push(player); }
            else if (player.gender === 'Female') { categorizedData.Female[category].push(player); allFemalePlayers.push(player); }
        });
        const workbook = new ExcelJS.Workbook(); const subtitle = `${courseName} - ${new Date(tournamentDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;
        buildGrossChampionsSheet(workbook.addWorksheet('Campeões Gross'), playersWithScores);
        if(allMalePlayers.length > 0){ allMalePlayers.sort(tiebreakSort); await buildHorizontalScorecard(workbook.addWorksheet('Leaderboard NET Masculino'), `${tournamentName} - Leaderboard Geral NET Masculino`, subtitle, courseData, allMalePlayers); await Promise.all(['M1', 'M2', 'M3', 'M4'].map(async category => { const players = categorizedData.Male[category]; if (players.length > 0) { players.sort(tiebreakSort); await buildHorizontalScorecard(workbook.addWorksheet(`${category} Masculino`), `${tournamentName} - Categoria ${category} Masculino`, subtitle, courseData, players); } })); }
        if(allFemalePlayers.length > 0) { allFemalePlayers.sort(tiebreakSort); await buildHorizontalScorecard(workbook.addWorksheet('Leaderboard NET Feminino'), `${tournamentName} - Leaderboard Geral NET Feminino`, subtitle, courseData, allFemalePlayers); await Promise.all(['F1', 'F2', 'F3', 'F4'].map(async category => { const players = categorizedData.Female[category]; if (players.length > 0) { players.sort(tiebreakSort); await buildHorizontalScorecard(workbook.addWorksheet(`${category} Feminino`), `${tournamentName} - Categoria ${category} Feminino`, subtitle, courseData, players); } })); }
        const fileName = `relatorio_completo_${tournamentName.replace(/\s+/g, '_')}.xlsx`; res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition', `attachment; filename=${fileName}`); await workbook.xlsx.write(res); res.end();
    } catch (error) { 
        console.error("Erro ao exportar relatório de torneio:", error); 
        next(error); 
    }
    finally { if (connection) connection.release(); }
});

app.get("/api/courses", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { adminId } = req.query;
        connection = await pool.getConnection();
        const query = adminId
            ? "SELECT * FROM courses WHERE adminId = ?"
            : "SELECT id, name FROM courses ORDER BY name ASC";
        const params = adminId ? [adminId] : [];
        const [rows] = await connection.execute(query, params);
        res.json(rows);
    } catch (error: any) {
        console.error("Erro ao buscar campos:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/courses", upload.array("holeImages"), async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { name, location, adminId } = req.body;
        const holes = JSON.parse(req.body.holes);
        const files = req.files as Express.Multer.File[];
        const fileMap = new Map(files?.map((f) => [f.originalname, f.filename]) ?? []);

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
    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("Erro ao criar campo completo:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.delete("/api/courses/:id", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        await connection.execute("DELETE FROM courses WHERE id = ?", [id]);
        res.status(200).json({ message: "Campo apagado com sucesso." });
    } catch (error: any) {
        console.error("Erro ao apagar campo:", error);
        if ((error as any).code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(400).json({
                error: "Não pode apagar este campo, pois ele está a ser usado por um ou mais torneios.",
            });
        }
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/courses/:id/details", async (req: Request, res: Response, next: NextFunction) => {
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
    } catch (error: any) {
        console.error("Error ao buscar detalhes completos do campo:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.put("/api/courses/:id/details", async (req: Request, res: Response, next: NextFunction) => {
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
    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar campo:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/tournaments", async (req: Request, res: Response, next: NextFunction) => {
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
    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("Error ao criar torneio:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { adminId, status } = req.query; 
        connection = await pool.getConnection();
        
        let query = "SELECT * FROM tournaments";
        const params: (string | number)[] = [];
        const conditions: string[] = [];

        if (adminId) {
            conditions.push("adminId = ?");
            params.push(adminId as string);
        }
        
        if (status === 'active') {
             conditions.push("(status = 'IN_PROGRESS' OR status = 'SCHEDULED' OR status = 'pending')");
        } else if (status) {
             conditions.push("status = ?");
             params.push(status as string);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        
        query += " ORDER BY date DESC";
        
        const [rows] = await connection.execute(query, params);
        res.json(rows);
    } catch (error: any) {
        console.error("Erro ao buscar torneios:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA MODIFICADA (Lógica #2) - Agora busca torneios FINALIZADOS
app.get("/api/tournaments/finalized", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            "SELECT id, name, date, finishedAt FROM tournaments WHERE status = 'completed' ORDER BY finishedAt DESC"
        );
        res.json(rows);
    } catch (error: any) {
        console.error("Erro ao buscar torneios finalizados:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

// NOVA ROTA (Lógica #2) - Busca eventos ATIVOS (Torneios E Jogos de Aposta)
app.get("/api/events/active", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        connection = await pool.getConnection();
        
        // Query para Torneios Ativos
        const [tournaments] = await connection.execute(
            `SELECT id, name, date, 'tournament' as eventType 
             FROM tournaments 
             WHERE status = 'IN_PROGRESS' OR status = 'SCHEDULED' OR status = 'pending'`
        );

        // Query para Jogos de Aposta (multi_group trainings) Ativos
        const [trainings] = await connection.execute(
            `SELECT id, CONCAT('Jogo de Aposta: ', c.name) as name, date, 'training' as eventType 
             FROM trainings t
             JOIN courses c ON t.courseId = c.id
             WHERE (t.status = 'active' OR t.status = 'awaiting_groups') AND t.type = 'multi_group'`
        );

        const combinedEvents = [...(tournaments as any[]), ...(trainings as any[])];
        
        // Ordenar por data
        combinedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        res.json(combinedEvents);
    } catch (error: any) {
        console.error("Erro ao buscar eventos ativos:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

// NOVA ROTA (Lógica #4 e #5) - Exportação Geral de Jogo de Aposta (Treino multi_group)
app.get("/api/export/training/general/:trainingId", async (req: Request, res: Response, next: NextFunction) => {
    const { trainingId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        
        const [trainingInfo]: any[] = await connection.execute(
            `SELECT t.id, t.date, c.name as courseName, c.id as courseId
             FROM trainings t
             JOIN courses c ON t.courseId = c.id
             WHERE t.id = ? AND t.type = 'multi_group'`, [trainingId]
        );
        if (trainingInfo.length === 0) return res.status(404).send('Jogo de Aposta (multi-group) não encontrado.');
        
        const { date, courseName, courseId } = trainingInfo[0];
        
        const [holesResult]: any[] = await connection.execute(`SELECT id, holeNumber, par FROM holes WHERE courseId = ? ORDER BY holeNumber ASC`, [courseId]);
        const holes: HoleQueryResult[] = holesResult as HoleQueryResult[];
        for (const hole of holes) { 
            const [tees] = await connection.execute("SELECT * FROM tees WHERE holeId = ?", [hole.id]); 
            hole.tees = tees as TeeData[] ?? []; 
        }
        const courseData: CourseForScorecard = { holes, courseName, date };

        const [groups]: any[] = await connection.execute("SELECT id FROM training_groups WHERE trainingId = ?", [trainingId]);
        if (groups.length === 0) return res.status(404).send('Nenhum grupo encontrado para este jogo.');
        
        const groupIds = groups.map((g: { id: number }) => g.id);

        const [participantsResult]: any[] = await connection.execute(
            `SELECT DISTINCT p.id as playerId, p.fullName, p.gender, tp.courseHandicap
             FROM training_participants tp
             JOIN players p ON tp.playerId = p.id
             WHERE tp.trainingGroupId IN (?) AND tp.invitationStatus = 'accepted'`, [groupIds]
        );
        const participants: ScorecardPlayer[] = participantsResult as ScorecardPlayer[];

        const [allScoresResult]: any[] = await connection.execute(
            `SELECT playerId, holeNumber, strokes
             FROM training_scores WHERE trainingGroupId IN (?)`, [groupIds]
        );
        const allScores: ScoreQueryResult[] = allScoresResult as ScoreQueryResult[];

        // Calcular Totais (apenas GROSS, como pedido para treinos)
        for (const player of participants) {
            player.id = player.playerId; 
            const playerScores = allScores.filter(s => s.playerId === player.playerId);
            player.scores = playerScores.map(s => ({ holeNumber: s.holeNumber, strokes: s.strokes }));
            player.totalStrokes = playerScores.reduce((sum, s) => sum + (s.strokes || 0), 0);
            
            // Preencher dados "NET" como Gross para a função de exportação não falhar
            player.netScore = player.totalStrokes; 
            player.courseHandicap = player.courseHandicap ?? 0; // Usar o handicap se existir, ou 0
            player.tieBreakReason = '';
            player.tieBreakScores = { last9: 0, last6: 0, last3: 0, last1: 0 }; 
        }

        // Ordenar por GROSS
        participants.sort((a, b) => (a.totalStrokes ?? 999) - (b.totalStrokes ?? 999));

        // Gerar Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Resultado Geral Gross');
        const subtitle = `${courseName} - ${new Date(date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
        
        // Usar a sua função existente!
        await buildHorizontalScorecard(sheet, `Resultado Geral - Jogo de Aposta`, subtitle, courseData, participants);

        const fileName = `Relatorio_Geral_Treino_${trainingId}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (error: any) {
        console.error("Erro ao exportar relatório geral de treino:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});


app.get("/api/tournaments/:tournamentId/public", async (req: Request, res: Response, next: NextFunction) => {
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
    } catch (error: any) {
        console.error("Erro ao buscar detalhes públicos do torneio:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments/:tournamentId/registrations", async (req: Request, res: Response, next: NextFunction) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const query = `
            SELECT
                tr.id, tr.playerId as player_id, tr.tournamentId as tournament_id,
                tr.paymentStatus as payment_status, tr.registrationDate as registration_date,
                p.fullName, p.email
            FROM tournament_registrations tr
            INNER JOIN players p ON tr.playerId = p.id
            WHERE tr.tournamentId = ? ORDER BY tr.registrationDate DESC`;
        const [rows] = await connection.execute(query, [tournamentId]);
        const formattedRegistrations = (rows as any[]).map(row => ({
            id: row.id, player_id: row.player_id, tournament_id: row.tournament_id,
            payment_status: row.payment_status, registration_date: row.registration_date,
            player: { fullName: row.fullName, email: row.email }
        }));
        res.json(formattedRegistrations);
    } catch (error: any) {
        console.error('Erro ao buscar inscrições:', error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.patch("/api/registrations/:registrationId/status", async (req: Request, res: Response, next: NextFunction) => {
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
    } catch (error: any) {
        console.error("Erro ao atualizar pagamento:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/tournaments/:tournamentId/register", async (req: Request, res: Response, next: NextFunction) => {
    const { tournamentId } = req.params;
    const { playerId, answers } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();

        // CORREÇÃO: Converter IDs
        const numericTournamentId = parseInt(tournamentId, 10);
        const numericPlayerId = parseInt(playerId, 10);

        const [existing]: any = await connection.execute(
            "SELECT id FROM tournament_registrations WHERE playerId = ? AND tournamentId = ?",
            [numericPlayerId, numericTournamentId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: "Você já está inscrito neste torneio." });
        }
        const [result]: any = await connection.execute(
            "INSERT INTO tournament_registrations (playerId, tournamentId, paymentStatus) VALUES (?, ?, 'pending')",
            [numericPlayerId, numericTournamentId]
        );
        const registrationId = result.insertId;
        if (answers && Array.isArray(answers) && answers.length > 0) {
            for (const answer of answers) {
                if (answer.questionId && answer.answerText) {
                    await connection.execute(
                        "INSERT INTO registration_answers (registrationId, questionId, answer) VALUES (?, ?, ?)",
                        [registrationId, parseInt(answer.questionId, 10), answer.answerText]
                    );
                }
            }
        }
        res.status(201).json({
            success: true,
            message: "Inscrição realizada com sucesso!",
            registrationId: registrationId
        });
    } catch (error: any) {
        console.error("Erro interno ao realizar a inscrição:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments/:tournamentId/export-registrations", async (req: Request, res: Response, next: NextFunction) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const query = `
        SELECT
            tr.id as registration_id, p.fullName as player_name, p.email as player_email,
            tr.paymentStatus, tr.registrationDate, tq.questionText, ra.answer
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
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Inscritos');
        const registrationsMap = new Map();
        registrationsData.forEach((row: any) => {
            if (!registrationsMap.has(row.registration_id)) {
                registrationsMap.set(row.registration_id, {
                    player_name: row.player_name, player_email: row.player_email,
                    payment_status: row.paymentStatus, registration_date: row.registrationDate,
                    questions: {}
                });
            }
            if (row.questionText) {
                registrationsMap.get(row.registration_id).questions[row.questionText] = row.answer;
            }
        });
        const registrations = Array.from(registrationsMap.values());
        const headers = ['Nome', 'Email', 'Status Pagamento', 'Data Inscrição'];
        const questionHeadersSet = new Set<string>();
        registrationsData.forEach((row: any) => { if (row.questionText) questionHeadersSet.add(row.questionText); });
        const questionHeaders = Array.from(questionHeadersSet); headers.push(...questionHeaders);
        worksheet.addRow(headers);
        registrations.forEach((reg: any) => {
            const row = [ reg.player_name, reg.player_email, reg.payment_status, new Date(reg.registration_date).toLocaleDateString('pt-BR') ];
            questionHeaders.forEach((question: string) => { row.push(reg.questions[question] || ""); });
            worksheet.addRow(row);
        });
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };
        worksheet.columns.forEach((column: any) => { /* ... ajuste largura ... */ });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=inscritos_torneio_${tournamentId}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error: unknown) {
        console.error('Erro na exportação:', error);
        next(error);
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/trainings/groups/:groupId/invite", async (req: Request, res: Response, next: NextFunction) => {
  const { groupId } = req.params;
  const { playerIds } = req.body;
  let connection;
  try {
    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) return res.status(400).json({ error: "É necessário fornecer os IDs dos jogadores a convidar." });
    connection = await pool.getConnection();
    const values = playerIds.map(playerId => [parseInt(groupId), parseInt(playerId, 10), 'pending']); // CORREÇÃO: parseInt
    await connection.query("INSERT IGNORE INTO training_participants (trainingGroupId, playerId, invitationStatus) VALUES ?", [values]);
    res.status(200).json({ message: "Convites enviados com sucesso." });
  } catch (error: any) {
    console.error("Erro interno ao enviar convites:", error);
    const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
    res.status(500).json({ error: errorMessage });
  } finally {
    if (connection) connection.release();
  }
});

app.patch("/api/trainings/invitations/:participantId", async (req: Request, res: Response, next: NextFunction) => {
    const { participantId } = req.params;
    const { status } = req.body;
    let connection;
    try {
        if (!status || !['accepted', 'declined'].includes(status)) return res.status(400).json({ error: "Status inválido." });
        connection = await pool.getConnection();
        await connection.execute( "UPDATE training_participants SET invitationStatus = ? WHERE id = ?", [status, participantId] );
        res.status(200).json({ message: `Convite ${status === 'accepted' ? 'aceite' : 'recusado'} com sucesso.` });
    } catch (error: any) {
        console.error("Erro ao responder ao convite:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/users/:userId/invitations", async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const [invites] = await connection.execute(
      `SELECT tp.id as invitationId, p.fullName as inviterName, c.name as courseName, t.date
       FROM training_participants tp JOIN training_groups tg ON tp.trainingGroupId = tg.id
       JOIN trainings t ON tg.trainingId = t.id JOIN players p ON t.creatorId = p.id
       JOIN courses c ON t.courseId = c.id
       WHERE tp.playerId = ? AND tp.invitationStatus = 'pending' ORDER BY t.date DESC`,
      [userId]
    );
    res.json(invites);
  } catch (error: any) {
    console.error("Erro ao buscar convites:", error);
    const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
    res.status(500).json({ error: errorMessage });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/api/trainings/scorecard/:accessCode", async (req: Request, res: Response, next: NextFunction) => {
  let connection;
  try {
    const { accessCode } = req.params;
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ error: "Player ID é obrigatório." });

    connection = await pool.getConnection();
    const [groupDetails]: any[] = await connection.execute(
      `SELECT tg.id as groupId, tg.startHole, t.id as trainingId,
              c.name as courseName, c.id as courseId, t.status
       FROM training_groups tg JOIN trainings t ON tg.trainingId = t.id
       JOIN courses c ON t.courseId = c.id WHERE tg.accessCode = ?`, [accessCode]
    );
    if (groupDetails.length === 0) return res.status(404).json({ error: "Código de acesso de treino inválido." });

    const group = groupDetails[0]; group.tournamentName = "Sessão de Treino";
    const [players] = await connection.execute(
      `SELECT p.id, p.fullName, tp.teeColor FROM training_participants tp JOIN players p ON tp.playerId = p.id
       WHERE tp.trainingGroupId = ? AND tp.invitationStatus = 'accepted'`, [group.groupId]
    ); group.players = players;
    const [scores] = await connection.execute("SELECT playerId, holeNumber, strokes FROM training_scores WHERE trainingGroupId = ?", [group.groupId]); group.scores = scores;
    const [holes]: any[] = await connection.execute("SELECT id, courseId, holeNumber, par, aerialImageUrl FROM holes WHERE courseId = ? ORDER BY holeNumber", [group.courseId]);
    for (const hole of holes) { const [tees] = await connection.execute("SELECT * FROM tees WHERE holeId = ?", [hole.id]); hole.tees = tees; } group.holes = holes;
    res.json(group);
  } catch (error: any) {
    console.error("Erro ao buscar dados do scorecard de treino:", error);
    const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
    res.status(500).json({ error: errorMessage });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/api/training_scores/hole", async (req: Request, res: Response, next: NextFunction) => {
  const { groupId, holeNumber, scores } = req.body;
  let connection;
  try {
    if (!groupId || !holeNumber || !scores || !Array.isArray(scores)) return res.status(400).json({ error: "Dados incompletos ou em formato inválido." });
    
    const numericGroupId = parseInt(groupId, 10);
    const numericHoleNumber = parseInt(holeNumber, 10);

    connection = await pool.getConnection();
    await connection.beginTransaction();
    for (const score of scores as { playerId: number, strokes: number }[]) {
      if (score.strokes === null || score.strokes === undefined) continue;
      
      const numericPlayerId = parseInt(score.playerId as any, 10);
      const numericStrokes = parseInt(score.strokes as any, 10);

      if(isNaN(numericPlayerId) || isNaN(numericStrokes)) continue; 

      await connection.execute(
        `INSERT INTO training_scores (trainingGroupId, playerId, holeNumber, strokes) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE strokes = ?`,
        [numericGroupId, numericPlayerId, numericHoleNumber, numericStrokes, numericStrokes]
      );
    }
    await connection.commit();
    res.status(200).json({ message: "Pontuações do treino salvas com sucesso."});
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error("Erro ao salvar pontuações do treino:", error);
    const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
    res.status(500).json({ error: errorMessage });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/api/trainings/finish", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { groupId } = req.body;
        if (!groupId) return res.status(400).json({ error: "ID do grupo de treino é obrigatório." });
        connection = await pool.getConnection();
        await connection.execute(
            "UPDATE trainings SET status = 'completed', finishedAt = NOW() WHERE id = (SELECT trainingId FROM training_groups WHERE id = ?)",
            [groupId]
        );
        res.status(200).json({ success: true, message: "Treino finalizado e adicionado ao histórico!" });
    } catch (error: any) {
        console.error("Erro ao finalizar treino:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/trainings/history/:trainingGroupId/player/:playerId", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { playerId, trainingGroupId } = req.params;
        connection = await pool.getConnection();
        const [results]: any[] = await connection.execute(
            `SELECT ts.holeNumber, ts.strokes, h.par, tee.yardage
             FROM training_scores ts JOIN training_groups tg ON ts.trainingGroupId = tg.id
             JOIN trainings t ON tg.trainingId = t.id
             JOIN holes h ON ts.holeNumber = h.holeNumber AND t.courseId = h.courseId
             JOIN training_participants tp ON tg.id = tp.trainingGroupId AND ts.playerId = tp.playerId 
             LEFT JOIN tees tee ON h.id = tee.holeId AND tp.teeColor = tee.color
             WHERE ts.playerId = ? AND ts.trainingGroupId = ? ORDER BY ts.holeNumber`,
            [playerId, trainingGroupId]
        );
        res.json(results);
    } catch (error: any) {
        console.error("Erro ao buscar detalhes do treino:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/players/search", async (req: Request, res: Response, next: NextFunction) => {
  const { search, excludeTrainingGroup } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    let query = `SELECT p.id, p.fullName, p.email, p.gender FROM players p WHERE p.role != 'admin'`;
    const params: any[] = [];
    if (search) { query += " AND p.fullName LIKE ?"; params.push(`%${search}%`); }
    if (excludeTrainingGroup) { query += ` AND p.id NOT IN (SELECT tp.playerId FROM training_participants tp WHERE tp.trainingGroupId = ?)`; params.push(excludeTrainingGroup); }
    query += " ORDER BY p.fullName ASC LIMIT 20";
    const [players] = await connection.execute(query, params);
    res.json(players);
  } catch (error: any) {
    console.error("Erro ao buscar jogadores:", error);
    const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
    res.status(500).json({ error: errorMessage });
  } finally {
    if (connection) connection.release();
  }
});

app.delete("/api/tournaments/:id", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        await connection.execute("DELETE FROM tournaments WHERE id = ?", [id]);
        res.status(200).json({ message: "Torneio apagado com sucesso." });
    } catch (error: any) {
        console.error("Erro ao apagar torneio:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.put("/api/tournaments/:id", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { id } = req.params;
        const { bannerImageUrl, paymentInstructions, categories } = req.body;
        connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.execute(
            `UPDATE tournaments SET bannerImageUrl = ?, paymentInstructions = ? WHERE id = ?`,
            [bannerImageUrl, paymentInstructions, id]
        );
        await connection.execute("DELETE FROM tournament_categories WHERE tournamentId = ?", [id]);
        if (categories && Array.isArray(categories) && categories.length > 0) {
            const categoryQuery = "INSERT INTO tournament_categories (tournamentId, name) VALUES ?";
            const categoryValues = categories.map((catName: string) => [id, catName]);
            await connection.query(categoryQuery, [categoryValues]);
        }
        await connection.commit();
        res.status(200).json({ message: "Configurações do torneio atualizadas com sucesso." });
    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar configurações do torneio:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/tournaments/:id/finish", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        await connection.execute( "UPDATE tournaments SET status = 'completed', finishedAt = NOW() WHERE id = ?", [id] );
        res.status(200).json({ success: true, message: "Torneio finalizado e movido para o histórico!" });
    } catch (error: any) {
        console.error("Erro ao finalizar torneio:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments/:tournamentId/tees", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { tournamentId } = req.params;
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            `SELECT DISTINCT t.color FROM tees t JOIN holes h ON t.holeId = h.id
             JOIN courses c ON h.courseId = c.id JOIN tournaments tour ON c.id = tour.courseId
             WHERE tour.id = ?`, [tournamentId] );
        res.json(rows);
    } catch (error: any) {
        console.error("Erro ao buscar tees do torneio:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments/:tournamentId/export-groups", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { tournamentId } = req.params;
        connection = await pool.getConnection();
        const [tournamentRows]: any[] = await connection.execute( "SELECT name, date, startTime FROM tournaments WHERE id = ?", [tournamentId] );
        if (tournamentRows.length === 0) return res.status(404).json({ error: "Torneio não encontrado." });
        const tournament = tournamentRows[0];
        const TEE_TIME_INTERVAL = 10;
        const [groupRows]: any[] = await connection.execute(
            `SELECT g.id as groupId, g.startHole, g.accessCode, p.fullName
             FROM \`groups\` g JOIN group_players gp ON g.id = gp.groupId JOIN players p ON gp.playerId = p.id
             WHERE g.tournamentId = ? ORDER BY g.startHole, g.id, p.fullName`, [tournamentId] );
        if (groupRows.length === 0) return res.status(404).json({ error: "Nenhum grupo encontrado para este torneio." });
        
        const groupsByHole = groupRows.reduce((acc: Record<string, Map<number, any>>, row: any) => {
            const { startHole, groupId, ...playerData } = row;
            if (!acc[startHole]) acc[startHole] = new Map();
            if (!acc[startHole].has(groupId)) {
                acc[startHole].set(groupId, { ...playerData, players: [] });
            }
            acc[startHole].get(groupId).players.push(playerData.fullName);
            return acc;
        }, {});

        const workbook = new ExcelJS.Workbook(); workbook.creator = "Birdify";
        const sheet = workbook.addWorksheet("Horários de Saída");
        sheet.mergeCells("A1:D1");
        const titleCell = sheet.getCell("A1");
        titleCell.value = tournament.name.toUpperCase();
        titleCell.font = { name: "Calibri", size: 16, bold: true };
        titleCell.alignment = { vertical: "middle", horizontal: "center" };
        let currentRow = 3;
        
        const sortedHoles = Object.keys(groupsByHole).sort((a, b) => parseInt(a) - parseInt(b));

        for (const hole of sortedHoles) {
            const groups = Array.from(groupsByHole[hole].values());
            sheet.mergeCells(`A${currentRow}:D${currentRow}`);
            const teeTitleCell = sheet.getCell(`A${currentRow}`);
            teeTitleCell.value = `HORÁRIO DE SAÍDA - TEE ${hole}`;
            teeTitleCell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
            teeTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };
            teeTitleCell.alignment = { vertical: "middle", horizontal: "center" };
            currentRow++;
            const headerRow = sheet.addRow(["HORA", "MATCH", "JOGADORES", "CÓDIGO"]);
            headerRow.font = { bold: true };
            headerRow.alignment = { vertical: "middle", horizontal: "center" };
            currentRow++;
            let matchNumber = 1;
            const teeTimeStr = `${tournament.date.toISOString().split("T")[0]}T${tournament.startTime || "08:00:00"}-03:00`;
            let teeTime = new Date(teeTimeStr);

            groups.forEach((group: any) => {
                const formattedTime = teeTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
                const startRow = currentRow;
                group.players.forEach((playerName: string, index: number) => {
                    if (index == 0) sheet.addRow([formattedTime, matchNumber, playerName, group.accessCode]);
                    else sheet.addRow(["", "", playerName, ""]);
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
        sheet.columns.forEach((column: any) => { 
            let maxLength = 0;
            column.eachCell!({ includeEmpty: true }, (cell) => {
                let columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength + 2;
         });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=Horarios_de_Saida.xlsx");
        await workbook.xlsx.write(res); res.end();
    } catch (error: any) {
        console.error("Erro ao exportar grupos:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/players", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { tournamentId, modality } = req.query;
        connection = await pool.getConnection();
        let params: any[] = [];
        let query = "SELECT id, fullName, gender FROM players WHERE role != 'admin'";
        if (modality) { query += " AND modality = ?"; params.push(modality); }
        if (tournamentId) {
            query += ` AND id NOT IN ( SELECT gp.playerId FROM group_players gp JOIN \`groups\` g ON gp.groupId = g.id WHERE g.tournamentId = ? )`;
            params.push(tournamentId);
        }
        query += " ORDER BY fullName";
        const [rows] = await connection.execute(query, params);
        res.json(rows);
    } catch (error: any) {
        console.error("Erro ao buscar jogadores:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/players", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { fullName, email, password, gender, club } = req.body;
        if (!fullName || !email || !password || !gender) return res.status(400).json({ error: "Campos essenciais em falta." });
        const saltRounds = 10; const hashedPassword = await bcrypt.hash(password, saltRounds);
        const modality = 'Golf'; 
        connection = await pool.getConnection();
        const query = `INSERT INTO players (fullName, email, password, gender, modality, club) VALUES (?, ?, ?, ?, ?, ?)`;
        const [result]: any = await connection.execute(query, [ fullName, email, hashedPassword, gender, modality, club || null ]);
        res.status(201).json({ success: true, id: result.insertId });
    } catch (error: any) {
        console.error("Erro ao cadastrar jogador:", error);
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "O Email fornecido já está em uso." });
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments/:tournamentId/groups", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { tournamentId } = req.params;
        connection = await pool.getConnection();
        const [groups]: any[] = await connection.execute( "SELECT * FROM `groups` WHERE tournamentId = ?", [tournamentId] );
        for (const group of groups) {
            const [players] = await connection.execute( `SELECT p.id as playerId, p.fullName, p.gender, gp.isResponsible, gp.teeColor FROM group_players gp JOIN players p ON gp.playerId = p.id WHERE gp.groupId = ?`, [group.id] );
            group.players = players;
        }
        res.json(groups);
    } catch (error: any) {
        console.error("Erro ao buscar grupos:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/groups", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { tournamentId, startHole, players, responsiblePlayerId } = req.body;
        
        // CORREÇÃO: Converter IDs
        const numericTournamentId = parseInt(tournamentId, 10);
        const numericStartHole = parseInt(startHole, 10);
        const numericResponsiblePlayerId = parseInt(responsiblePlayerId, 10);

        const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [groupResult]: any = await connection.execute( "INSERT INTO `groups` (tournamentId, startHole, accessCode) VALUES (?, ?, ?)", [numericTournamentId, numericStartHole, accessCode] );
        const newGroupId = groupResult.insertId;
        for (const player of players) {
            const numericPlayerId = parseInt(player.id, 10);
            await connection.execute( "INSERT INTO group_players (groupId, playerId, isResponsible, teeColor) VALUES (?, ?, ?, ?)", [newGroupId, numericPlayerId, numericPlayerId === numericResponsiblePlayerId, player.teeColor] );
        }
        await connection.commit();
        res.status(201).json({ success: true, message: "Grupo criado com sucesso!", accessCode });
    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("ERRO DETALHADO AO CRIAR GRUPO:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/groups/:id", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        const [groupRows]: any[] = await connection.execute( "SELECT * FROM `groups` WHERE id = ?", [id] );
        if (groupRows.length == 0) return res.status(404).json({ error: "Grupo não encontrado." });
        const group = groupRows[0];
        const [players] = await connection.execute( `SELECT p.id, p.fullName, p.gender, gp.isResponsible, gp.teeColor FROM group_players gp JOIN players p ON gp.playerId = p.id WHERE gp.groupId = ?`, [group.id] );
        group.players = players;
        res.json(group);
    } catch (error: any) {
        console.error("Erro ao buscar detalhes do grupo:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.put("/api/groups/:id", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { id } = req.params;
        const { startHole, players, responsiblePlayerId, category } = req.body;

        // CORREÇÃO: Converter IDs
        const numericGroupId = parseInt(id, 10);
        const numericStartHole = parseInt(startHole, 10);
        const numericResponsiblePlayerId = parseInt(responsiblePlayerId, 10);

        connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.execute( "UPDATE `groups` SET startHole = ?, category = ? WHERE id = ?", [numericStartHole, category || null, numericGroupId] ); 
        await connection.execute("DELETE FROM group_players WHERE groupId = ?", [numericGroupId]);
        for (const player of players) {
            const numericPlayerId = parseInt(player.id, 10);
            await connection.execute( "INSERT INTO group_players (groupId, playerId, isResponsible, teeColor) VALUES (?, ?, ?, ?)", [numericGroupId, numericPlayerId, numericPlayerId === numericResponsiblePlayerId, player.teeColor] );
        }
        await connection.commit();
        res.status(200).json({ message: "Grupo atualizado com sucesso!" });
    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar grupo:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.delete("/api/groups/:id", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        await connection.execute("DELETE FROM `groups` WHERE id = ?", [id]);
        res.status(200).json({ message: "Grupo apagado com sucesso." });
    } catch (error: any) {
        console.error("Erro ao apagar grupo:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/groups/handicaps", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { groupId, handicaps } = req.body;
        if (!groupId || !handicaps) return res.status(400).json({ error: "Dados incompletos." });
        connection = await pool.getConnection();
        for (const playerId in handicaps) {
            const courseHandicap = handicaps[playerId];
            await connection.execute( "UPDATE group_players SET courseHandicap = ? WHERE groupId = ? AND playerId = ?", [courseHandicap, groupId, playerId] );
        }
        res.status(200).json({ message: "Handicaps atualizados com sucesso." });
    } catch (error: any) {
        console.error("Erro ao atualizar handicaps:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/groups/finish", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { groupId } = req.body;
        if (!groupId) return res.status(400).json({ error: "ID do grupo é obrigatório." });
        connection = await pool.getConnection();
        await connection.execute( "UPDATE `groups` SET status = 'completed' WHERE id = ?", [groupId] );
        res.status(200).json({ message: "Rodada finalizada com sucesso!" });
    } catch (error: any) {
        console.error("Erro ao finalizar rodada:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/login", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, error: "Email e senha são obrigatórios." });
        connection = await pool.getConnection();
        const query = "SELECT id, fullName, email, role, gender, password FROM players WHERE email = ?";
        const [rows]: any[] = await connection.execute(query, [email]);
        if (rows.length === 0) return res.status(401).json({ success: false, error: "Email ou senha inválidos." });
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const { password: _, ...userWithoutPassword } = user;
            res.status(200).json({ success: true, user: userWithoutPassword });
        } else {
            res.status(401).json({ success: false, error: "Email ou senha inválidos." });
        }
    } catch (error: any) {
        console.error("Erro no login:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/scorecard/:accessCode", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { accessCode } = req.params;
        const { playerId } = req.query;
        if (!playerId) return res.status(400).json({ error: "Player ID é obrigatório para aceder ao scorecard." });

        const numericPlayerId = parseInt(playerId as string, 10);

        connection = await pool.getConnection();
        const [groupDetails]: any[] = await connection.execute(
            `SELECT g.id as groupId, g.startHole, g.status, t.id as tournamentId, t.name as tournamentName, c.name as courseName, c.id as courseId
             FROM \`groups\` g JOIN tournaments t ON g.tournamentId = t.id
             JOIN courses c ON t.courseId = c.id WHERE g.accessCode = ?`, [accessCode]
        );
        if (groupDetails.length === 0) return res.status(404).json({ error: "Código de acesso inválido." });
        const group = groupDetails[0];
        const [userRole]: any[] = await connection.execute( "SELECT role FROM players WHERE id = ?", [numericPlayerId] );
        const isAdmin = userRole.length > 0 && userRole[0].role === "admin";
        if (!isAdmin) {
            const [playersInGroup]: any[] = await connection.execute( "SELECT playerId FROM group_players WHERE groupId = ?", [group.groupId] );
            const isPlayerInGroup = playersInGroup.some( (p: { playerId: number }) => p.playerId === numericPlayerId );
            if (!isPlayerInGroup) return res.status(403).json({ error: "Acesso negado: você não pertence a este grupo." });
        }
        const [players] = await connection.execute(
            `SELECT p.id, p.fullName, gp.teeColor FROM group_players gp JOIN players p ON gp.playerId = p.id
             WHERE gp.groupId = ?`, [group.groupId]
        );
        group.players = players;
        const [scores] = await connection.execute( "SELECT playerId, holeNumber, strokes FROM scores WHERE groupId = ?", [group.groupId] );
        group.scores = scores;
        const [holes]: any[] = await connection.execute( "SELECT id, courseId, holeNumber, par, aerialImageUrl FROM holes WHERE courseId = ? ORDER BY holeNumber", [group.courseId] );
        for (const hole of holes) { const [tees] = await connection.execute("SELECT * FROM tees WHERE holeId = ?", [hole.id]); hole.tees = tees; }
        group.holes = holes;
        res.json(group);
    } catch (error: any) {
        console.error("Erro ao buscar dados do scorecard:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/leaderboard/:tournamentId", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { tournamentId } = req.params;
        connection = await pool.getConnection();
        const [players]: any[] = await connection.execute(
            `SELECT p.id, p.fullName, p.gender, gp.courseHandicap, g.id as groupId
             FROM players p JOIN group_players gp ON p.id = gp.playerId
             JOIN \`groups\` g ON gp.groupId = g.id WHERE g.tournamentId = ?`, [tournamentId] );
        interface Hole { holeNumber: number; par: number; }
        const [holes] = await connection.execute(
            `SELECT h.holeNumber, h.par FROM holes h JOIN courses c ON h.courseId = c.id
             JOIN tournaments t ON c.id = t.courseId WHERE t.id = ? ORDER BY h.holeNumber`, [tournamentId] );
        const parMap = new Map((holes as { holeNumber: number; par: number }[]).map((h) => [h.holeNumber, h.par]));
        for (const player of players) {
            const [scores] = await connection.execute( "SELECT holeNumber, strokes FROM scores WHERE playerId = ? AND groupId = ?", [player.id, player.groupId] );
            const typedScores = scores as { holeNumber: number; strokes: number }[];
            player.grossTotal = typedScores.reduce((sum, score) => sum + (score.strokes || 0), 0); 
            let toPar = 0;
            for (const score of typedScores) { toPar += (score.strokes || 0) - (parMap.get(score.holeNumber) || 0); } 
            player.toPar = toPar;
            player.netToPar = toPar - (player.courseHandicap || 0);
            player.through = typedScores.length;
        }
        const typedPlayers = players as any[];
        typedPlayers.sort((a, b) => (a.netToPar ?? 999) - (b.netToPar ?? 999)); 
        let rank = 1;
        for (let i = 0; i < typedPlayers.length; i++) {
            if (i > 0 && typedPlayers[i].netToPar > typedPlayers[i - 1].netToPar) { rank = i + 1; }
            typedPlayers[i].rank = rank;
        }
        res.json(typedPlayers);
    } catch (error: any) {
        console.error("Erro ao calcular leaderboard:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/history/player/:playerId/tournament/:tournamentId", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { playerId, tournamentId } = req.params;
        connection = await pool.getConnection();
        const [results]: any[] = await connection.execute(
            `SELECT s.holeNumber, s.strokes, h.par, tee.yardage
             FROM scores s
             JOIN \`groups\` g ON s.groupId = g.id
             JOIN holes h ON s.holeNumber = h.holeNumber
             JOIN tournaments t ON g.tournamentId = t.id AND t.courseId = h.courseId 
             JOIN group_players gp ON g.id = gp.groupId AND s.playerId = gp.playerId 
             LEFT JOIN tees tee ON h.id = tee.holeId AND gp.teeColor = tee.color
             WHERE s.playerId = ? AND g.tournamentId = ?
             ORDER BY s.holeNumber`,
            [playerId, tournamentId]
        );
        res.json(results);
    } catch (error: any) {
        console.error("Erro ao buscar detalhes do torneio do jogador:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/forgot-password", async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows]: any[] = await connection.execute("SELECT * FROM players WHERE email = ?", [email]);
        if (rows.length === 0) {
            return res.status(200).json({ message: "Se o seu email estiver em nossa base de dados, você receberá um link para redefinir sua senha." });
        }
        const user = rows[0];
        const token = crypto.randomBytes(20).toString("hex");
        const expires = new Date(Date.now() + 3600000); 
        await connection.execute( "UPDATE players SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?", [token, expires, user.id] );
        
        // CORREÇÃO: Usar variáveis de ambiente para email
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { 
                user: process.env.EMAIL_USER, // <-- CORRIGIDO
                pass: process.env.EMAIL_PASS  // <-- CORRIGIDO
            },
        });
        const mailOptions = {
            to: user.email,
            from: `Birdify <${process.env.EMAIL_USER}>`,
            subject: "Redefinição de Senha - Birdify",
            text: `Você está recebendo este email porque você (ou outra pessoa) solicitou a redefinição da sua senha.\n\n` +
                  `Por favor, clique no link a seguir ou cole-o no seu navegador para completar o processo:\n\n` +
                  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset/${token}\n\n` + // <-- CORRIGIDO
                  `Se você não solicitou isso, por favor, ignore este email e sua senha permanecerá inalterada.\n`,
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Um email foi enviado com as instruções para redefinir a sua senha." });
    } catch (error: any) {
        console.error("Erro em forgot-password:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/reset-password", async (req: Request, res: Response, next: NextFunction) => {
    const { token, password } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows]: any[] = await connection.execute( "SELECT * FROM players WHERE resetPasswordToken = ? AND resetPasswordExpires > NOW()", [token] );
        if (rows.length === 0) return res.status(400).json({ error: "O token para redefinição de senha é inválido ou expirou." });
        const user = rows[0]; const saltRounds = 10; const hashedPassword = await bcrypt.hash(password, saltRounds);
        await connection.execute( "UPDATE players SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?", [hashedPassword, user.id] );
        res.status(200).json({ message: "Sua senha foi redefinida com sucesso!" });
    } catch (error: any) {
        console.error("Erro em reset-password:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments/:tournamentId/questions", async (req: Request, res: Response, next: NextFunction) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [questions]: any[] = await connection.execute( 'SELECT * FROM tournament_questions WHERE tournamentId = ? ORDER BY id ASC', [tournamentId] );
        for (const question of questions) {
            if (question.questionType === 'MULTIPLE_CHOICE') {
                const [options] = await connection.execute( 'SELECT * FROM question_options WHERE questionId = ? ORDER BY id ASC', [question.id] );
                question.options = options;
            }
        }
        res.json(questions);
    } catch (error: any) {
        console.error("Erro ao buscar perguntas do torneio:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/tournaments/:tournamentId/questions", async (req: Request, res: Response, next: NextFunction) => {
    const { tournamentId } = req.params;
    const { questionText, questionType, isRequired, options } = req.body;
    let connection;
    try {
        if (!questionText || !questionType) return res.status(400).json({ error: "Texto e tipo da pergunta são obrigatórios." });
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [questionResult]: any = await connection.execute( 'INSERT INTO tournament_questions (tournamentId, questionText, questionType, isRequired) VALUES (?, ?, ?, ?)', [tournamentId, questionText, questionType, isRequired] );
        const newQuestionId = questionResult.insertId;
        if (questionType == 'MULTIPLE_CHOICE' && options && options.length > 0) {
            const optionValues = options.map((opt: string) => [newQuestionId, opt]);
            await connection.query('INSERT INTO question_options (questionId, optionText) VALUES ?', [optionValues]);
        }
        await connection.commit();
        res.status(201).json({ message: 'Pergunta criada com sucesso!', questionId: newQuestionId });
    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("Erro ao criar pergunta:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.delete("/api/questions/:questionId", async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const { questionId } = req.params;
        connection = await pool.getConnection();
        await connection.execute('DELETE FROM tournament_questions WHERE id = ?', [questionId]);
        res.status(200).json({ message: 'Pergunta apagada com sucesso.' });
    } catch (error: any) {
        console.error("Erro ao apagar pergunta:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/tournaments/:tournamentId/registrations-with-answers", async (req: Request, res: Response, next: NextFunction) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [registrations]: any[] = await connection.execute(
            `SELECT r.id, r.paymentStatus, p.fullName, p.email
             FROM tournament_registrations r JOIN players p ON r.playerId = p.id
             WHERE r.tournamentId = ? ORDER BY p.fullName ASC`, [tournamentId]
        );
        for (const reg of registrations) {
            const [answers]: any[] = await connection.execute(
                `SELECT q.questionText, a.answer FROM registration_answers a JOIN tournament_questions q ON a.questionId = q.id
                 WHERE a.registrationId = ? ORDER BY q.id ASC`, [reg.id]
            );
            reg.answers = answers;
        }
        res.json(registrations);
    } catch (error: any) {
        console.error("Erro ao buscar inscrições com respostas:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.post("/api/scores/hole", async (req: Request, res: Response, next: NextFunction) => {
    const { groupId, holeNumber, scores } = req.body;
    let connection;
    try {
        if (!groupId || !holeNumber || !scores || !Array.isArray(scores)) return res.status(400).json({ error: "Dados incompletos ou em formato inválido." });

        // CORREÇÃO: Converter IDs
        const numericGroupId = parseInt(groupId, 10);
        const numericHoleNumber = parseInt(holeNumber, 10);

        connection = await pool.getConnection();
        await connection.beginTransaction();
        for (const score of scores) {
            if (score.strokes === null || score.strokes === undefined) continue;
            
            const numericPlayerId = parseInt(score.playerId, 10);
            const numericStrokes = parseInt(score.strokes, 10);

            if (isNaN(numericPlayerId) || isNaN(numericStrokes)) continue; // Ignora se for inválido

            const query = `INSERT INTO scores (groupId, playerId, holeNumber, strokes) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE strokes = ?`;
            await connection.execute(query, [numericGroupId, numericPlayerId, numericHoleNumber, numericStrokes, numericStrokes]);
        }
        await connection.commit();
        res.status(200).json({ message: "Pontuações do buraco salvas com sucesso." });
    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("Erro ao salvar pontuações do buraco:", error);
        const errorMessage = error.sqlMessage || error.message || "Erro desconhecido no servidor.";
        res.status(500).json({ error: errorMessage });
    } finally {
        if (connection) connection.release();
    }
});

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] - ${req.method} ${req.url}`);
    next();
});

app.get('/api/teste-debug', async (req, res) => {
    console.log('✅ TESTE DEBUG - Esta mensagem DEVE aparecer no terminal!');
    res.json({ message: 'Teste OK - Verifique o terminal!' });
});

app.get("/api/debug/tournaments/:tournamentId/registrations", async (req: Request, res: Response, next: NextFunction) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const query = `
            SELECT tr.id, tr.playerId as player_id, tr.tournamentId as tournament_id, tr.paymentStatus as payment_status,
                   tr.registrationDate as registration_date, p.fullName, p.email
            FROM tournament_registrations tr INNER JOIN players p ON tr.playerId = p.id
            WHERE tr.tournamentId = ? ORDER BY tr.registrationDate DESC`;
        const [rows] = await connection.execute(query, [tournamentId]);
        const formattedRegistrations = (rows as any[]).map(row => ({
            id: row.id, player_id: row.player_id, tournament_id: row.tournament_id, payment_status: row.payment_status,
            registration_date: row.registration_date, player: { fullName: row.fullName, email: row.email }
        }));
        res.json(formattedRegistrations);
    } catch (error: any) {
        console.error('❌ DEBUG - ERRO COMPLETO:', error);
        next(error);
    } finally {
        if (connection) connection.release();
    }
});

// ===================================================================
// ERROR HANDLER GLOBAL - Deve ser o ÚLTIMO middleware
// ===================================================================
app.use((err: any, req: Request, res: Response, next: Function) => {
  console.error("\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.error("!!! ERRO GLOBAL CAPTURADO PELO HANDLER !!!");
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.error("Timestamp:", new Date().toISOString());
  console.error("Rota:", req.method, req.originalUrl);
  console.error("Body Recebido:", req.body);
  console.error("Erro Completo:", err);
  console.error("Stack Trace:", err.stack);
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n\n");

  res.status(500).json({
    error: "Erro Interno do Servidor.",
    message: err.message || "Ocorreu um erro inesperado.",
    sqlMessage: err.sqlMessage || undefined,
    sqlState: err.sqlState || undefined,
  });
});
// ===================================================================

app.listen(port, () => {
    console.log(`✅ Servidor backend (Versão Corrigida) rodando em http://localhost:${port}`);
});

console.log("--- FIM DO FICHEIRO server.ts ---");