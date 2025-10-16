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

const uploadsDir = path.join(__dirname, "uploads");
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
    waitForConnections: true,
    queueLimit: 0
};
const pool = mysql.createPool(dbConfig);

// --- TIPOS E INTERFACES ---
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
    parThrough?: number;
    toParGross?: number;
    netToPar?: number;
    through?: number;
}
interface HoleWithTees {
    holeNumber: number; par: number;
    tees: { color: string, yardage: number }[];
}
interface CourseForScorecard {
    holes: HoleWithTees[];
}


app.post("/api/trainings", async (req: Request, res: Response) => {
    const { courseId, creatorId, date, startHole } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [trainingResult]: any = await connection.execute(
            "INSERT INTO trainings (courseId, creatorId, date, status) VALUES (?, ?, ?, 'active')",
            [courseId, creatorId, date]
        );
        const trainingId = trainingResult.insertId;
        const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const [groupResult]: any = await connection.execute(
            "INSERT INTO training_groups (trainingId, startHole, accessCode) VALUES (?, ?, ?)",
            [trainingId, startHole, accessCode]
        );
        const trainingGroupId = groupResult.insertId;
        await connection.execute(
            "INSERT INTO training_participants (trainingGroupId, playerId, isResponsible, invitationStatus) VALUES (?, ?, ?, 'accepted')",
            [trainingGroupId, creatorId, 1]
        );
        await connection.commit();
        
        const [courseInfo]: any[] = await connection.execute("SELECT name FROM courses WHERE id = ?", [courseId]);

        res.status(201).json({
            id: trainingId,
            trainingGroupId,
            accessCode,
            date,
            courseName: courseInfo[0].name,
            creatorId,
            status: 'active'
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao criar treino:", error);
        res.status(500).json({ error: "Erro ao criar treino." });
    } finally {
        if (connection) connection.release();
    }
});

app.delete("/api/trainings/:trainingId/creator/:creatorId", async (req: Request, res: Response) => {
    const { trainingId, creatorId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();

        const [trainingRows]: any[] = await connection.execute(
            "SELECT creatorId FROM trainings WHERE id = ?",
            [trainingId]
        );

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
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao apagar treino:", error);
        res.status(500).json({ error: "Erro interno ao apagar o treino." });
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
            `SELECT t.id, t.date, t.status, c.name as courseName, tg.accessCode, t.creatorId, tg.id as trainingGroupId
             FROM trainings t
             JOIN courses c ON t.courseId = c.id
             JOIN training_groups tg ON t.id = tg.trainingId
             JOIN training_participants tp ON tg.id = tp.trainingGroupId
             WHERE tp.playerId = ? AND tp.invitationStatus = 'accepted' AND t.status = 'active'
             ORDER BY t.date DESC`, [userId]
        );
        res.json(trainings);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar treinos ativos." });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/trainings/history/player/:playerId", async (req: Request, res: Response) => {
    const { playerId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [trainings] = await connection.execute(
            `SELECT t.id, t.date, t.finishedAt, c.name as courseName, tg.id as trainingGroupId
             FROM trainings t
             JOIN courses c ON t.courseId = c.id
             JOIN training_groups tg ON t.id = tg.trainingId
             JOIN training_participants tp ON tg.id = tp.trainingGroupId
             WHERE tp.playerId = ? AND t.status = 'completed'
             ORDER BY t.finishedAt DESC`, [playerId]
        );
        res.json(trainings);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar histórico." });
    } finally {
        if (connection) connection.release();
    }
});


app.get("/api/trainings/groups/:groupId/participants", async (req: Request, res: Response) => {
    const { groupId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [participants] = await connection.execute(
            `SELECT p.id, p.fullName, p.email, tp.invitationStatus
             FROM training_participants tp
             JOIN players p ON tp.playerId = p.id
             WHERE tp.trainingGroupId = ?
             ORDER BY p.fullName`,
            [groupId]
        );
        res.json(participants);
    } catch (error) {
        console.error("Erro ao buscar participantes do treino:", error);
        res.status(500).json({ error: "Erro ao buscar participantes." });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/trainings/:trainingGroupId/export/:playerId", async (req: Request, res: Response) => {
    let connection;
    try {
        const { trainingGroupId, playerId } = req.params;
        connection = await pool.getConnection();
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
             ORDER BY ts.holeNumber`,
            [trainingGroupId, playerId]
        );

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
    } catch (error) {
        console.error("Erro ao exportar cartão:", error);
        res.status(500).json({ error: "Erro ao exportar." });
    } finally {
        if (connection) connection.release();
    }
});
app.get("/api/trainings/export/grupo/:groupId", async (req: Request, res: Response) => {
    const { groupId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Obter informações básicas do treino
        const [trainingInfo]: any[] = await connection.execute(
            `SELECT t.date, c.name as courseName, c.id as courseId 
             FROM trainings t
             JOIN training_groups tg ON t.id = tg.trainingId
             JOIN courses c ON t.courseId = c.id
             WHERE tg.id = ?`,
            [groupId]
        );

        if (trainingInfo.length === 0) {
            return res.status(404).send('Grupo de treino não encontrado.');
        }

        // 2. Obter todos os participantes do grupo
        const [players]: any[] = await connection.execute(
            `SELECT p.id, p.fullName 
             FROM players p 
             JOIN training_participants tp ON p.id = tp.playerId 
             WHERE tp.trainingGroupId = ? AND tp.invitationStatus = 'accepted'`,
            [groupId]
        );

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Resultados do Grupo');

        sheet.mergeCells('A1:D1');
        sheet.getCell('A1').value = `Resultado do Grupo - ${trainingInfo[0].courseName}`;
        sheet.getCell('A1').font = { size: 16, bold: true };
        sheet.addRow(['Data', new Date(trainingInfo[0].date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})]);
        sheet.addRow([]);

        // 3. Montar o cabeçalho com os nomes dos jogadores
        const headers = ['Buraco', 'Par'];
        players.forEach(p => headers.push(p.fullName));
        sheet.addRow(headers).font = { bold: true };
        
        // 4. Buscar os buracos e, para cada um, buscar o score de cada jogador
        const [holes]: any[] = await connection.execute('SELECT holeNumber, par FROM holes WHERE courseId = ? ORDER BY holeNumber', [trainingInfo[0].courseId]);
        
        const totals: Record<string, number> = {};
        players.forEach(p => totals[p.id] = 0);

        for (const hole of holes) {
            const rowData: (string | number)[] = [hole.holeNumber, hole.par];
            for (const player of players) {
                const [scoreResult]: any[] = await connection.execute(
                    `SELECT strokes FROM training_scores WHERE trainingGroupId = ? AND playerId = ? AND holeNumber = ?`,
                    [groupId, player.id, hole.holeNumber]
                );
                const strokes = scoreResult[0]?.strokes || 0;
                rowData.push(strokes);
                totals[player.id] += strokes;
            }
            sheet.addRow(rowData);
        }

        // 5. Adicionar a linha de totais
        const totalRow: (string | number)[] = ['Total', ''];
        players.forEach(p => totalRow.push(totals[p.id]));
        sheet.addRow(totalRow).font = { bold: true };

        sheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell!({ includeEmpty: true }, (cell) => {
                const len = cell.value ? cell.value.toString().length : 10;
                if (len > maxLength) {
                    maxLength = len;
                }
            });
            column.width = maxLength < 12 ? 12 : maxLength + 2;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=resultado_grupo_${groupId}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Erro ao exportar resultado do grupo de treino:", error);
        res.status(500).json({ error: "Erro ao exportar." });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/courses/public", async (req: Request, res: Response) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute("SELECT id, name FROM courses ORDER BY name ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar campos." });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/api/tournaments/:tournamentId/confirmed-players", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [players] = await connection.execute(
            `SELECT p.id as playerId, p.fullName, p.gender, tr.id as registrationId
             FROM tournament_registrations tr
             JOIN players p ON tr.playerId = p.id
             WHERE tr.tournamentId = ? AND tr.paymentStatus = 'confirmed'
             ORDER BY p.fullName ASC`, [tournamentId]
        );
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar jogadores confirmados." });
    } finally {
        if (connection) connection.release();
    }
});
app.get("/api/tournaments/:tournamentId/leaderboard", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();

        const [tournamentInfo]: any[] = await connection.execute("SELECT name FROM tournaments WHERE id = ?", [tournamentId]);
        if (tournamentInfo.length === 0) {
            return res.status(404).json({ error: "Torneio não encontrado." });
        }
        
        // Query para buscar os buracos e o par de cada um
        const [holes]: any[] = await connection.execute(`
            SELECT h.holeNumber, h.par 
            FROM holes h
            JOIN courses c ON h.courseId = c.id
            JOIN tournaments t ON c.id = t.courseId
            WHERE t.id = ?`, 
            [tournamentId]
        );
        const parMap = new Map(holes.map(h => [h.holeNumber, h.par]));

        // Query principal que agora inclui p.gender
        const [playerData]: any[] = await connection.execute(
            `SELECT
                p.id as playerId, p.fullName, p.gender, gp.courseHandicap, tcat.name as categoryName
             FROM players p
             JOIN group_players gp ON p.id = gp.playerId
             JOIN \`groups\` g ON gp.groupId = g.id
             LEFT JOIN tournament_registrations tr ON tr.playerId = p.id AND tr.tournamentId = g.tournamentId
             LEFT JOIN tournament_categories tcat ON tr.categoryId = tcat.id
             WHERE g.tournamentId = ?`,
            [tournamentId]
        );
        
        const [allScores]: any[] = await connection.execute(
            `SELECT s.playerId, s.holeNumber, s.strokes FROM scores s JOIN \`groups\` g ON s.groupId = g.id WHERE g.tournamentId = ?`,
            [tournamentId]
        );

        const leaderboardData = playerData.map(player => {
            const playerScores = allScores.filter(s => s.playerId === player.playerId);
            const totalStrokes = playerScores.reduce((sum, s) => sum + (s.strokes || 0), 0);
            const netScore = totalStrokes - (player.courseHandicap || 0);
            
            let parThrough = 0;
            playerScores.forEach(s => {
                parThrough += parMap.get(s.holeNumber) || 0;
            });

            return {
                ...player,
                totalStrokes,
                netScore,
                through: playerScores.length,
                parThrough,
                toParGross: totalStrokes - parThrough,
                netToPar: netScore - parThrough,
            };
        });

        res.json({
            tournamentName: tournamentInfo[0].name,
            leaderboard: leaderboardData
        });

    } catch (error) {
        console.error("Erro ao gerar leaderboard:", error);
        res.status(500).json({ error: "Erro interno ao gerar o leaderboard." });
    } finally {
        if (connection) connection.release();
    }
});

// ESTILOS GLOBAIS PARA AS PLANILHAS
const styler = {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } } as ExcelJS.Fill,
    font: { color: { argb: 'FF34D399' }, bold: true },
    border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
};


// NOVA FUNÇÃO HORIZONTAL - INSPIRADA NA SUA FUNÇÃO buildHorizontalScorecard
const buildLeaderboardSheet = (sheet: ExcelJS.Worksheet, title: string, players: ScorecardPlayer[], courseData: any) => {
    sheet.addRow([title]).font = { size: 16, bold: true };
    sheet.mergeCells('A1:Z1');
    sheet.getRow(1).alignment = { horizontal: 'center' };
    sheet.addRow([]);

    // Cabeçalho do campo (Tees, Distâncias, etc.)
    const teeColors = Array.from(new Set(courseData.holes.flatMap((h: any) => h.tees.map((t: any) => t.color)))).sort();
    
    // Linha dos Buracos
    const holeNumbers = ['Tee', null, ...courseData.holes.map((h: any) => h.holeNumber)];
    const holeRow = sheet.addRow(holeNumbers);
    holeRow.font = styler.font;
    
    // Linha do PAR
    const parData = ['PAR', null, ...courseData.holes.map((h: any) => h.par)];
    const parRow = sheet.addRow(parData);
    parRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Linhas de Distância (Yardage) por cor de Tee
    teeColors.forEach((color: any) => {
        const yardageData = [color, null, ...courseData.holes.map((h: any) => {
            const tee = h.tees.find((t: any) => t.color === color);
            return tee ? tee.yardage : '-';
        })];
        sheet.addRow(yardageData);
    });

    sheet.addRow([]); // Espaçador

    // Cabeçalho da tabela de jogadores
    const headers = ['Pos.', 'Nome', 'HDC', ...Array.from({ length: 9 }, (_, i) => i + 1), 'OUT', ...Array.from({ length: 9 }, (_, i) => i + 10), 'IN', 'GROSS', 'NET', 'Desempate Aplicado'];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell(cell => {
        cell.font = styler.font;
        cell.fill = styler.fill;
        cell.border = styler.border;
    });

    // Adiciona os dados dos jogadores
    players.forEach((player, index) => {
        const scores = Array(18).fill(null);
        player.scores.forEach(s => {
            if (s.holeNumber >= 1 && s.holeNumber <= 18) {
                scores[s.holeNumber - 1] = s.strokes;
            }
        });

        const playerRow = sheet.addRow([
            index + 1,
            player.fullName,
            player.courseHandicap,
            ...scores.slice(0, 9),
            null, // OUT
            ...scores.slice(9, 18),
            null, // IN
            player.totalStrokes,
            player.netScore,
            player.tieBreakReason || ''
        ]);
        
        // Adiciona fórmulas para OUT e IN
        const outCell = playerRow.getCell(13); // Coluna "OUT"
        outCell.value = { formula: `SUM(D${playerRow.number}:L${playerRow.number})` };
        
        const inCell = playerRow.getCell(23); // Coluna "IN"
        inCell.value = { formula: `SUM(N${playerRow.number}:V${playerRow.number})` };

        // Formatação
        playerRow.eachCell(cell => {
             cell.border = styler.border;
        });
    });
    
    sheet.getColumn('B').width = 30;
};


// FUNÇÃO PARA CRIAR ABA DE CAMPEÕES GROSS (mantida igual)
const buildGrossChampionsSheet = (sheet: ExcelJS.Worksheet, players: ScorecardPlayer[]) => {
    sheet.addRow(['Campeões Gross']).font = { size: 16, bold: true };
    sheet.mergeCells('A1:C1');
    sheet.getRow(1).alignment = { horizontal: 'center' };
    sheet.addRow([]);
    
    const headers = ['Pos.', 'Nome', 'GROSS'];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell(cell => {
        cell.font = styler.font;
        cell.fill = styler.fill;
        cell.border = styler.border;
    });

    const sortedPlayers = [...players].sort((a, b) => (a.totalStrokes || 0) - (b.totalStrokes || 0));

    sortedPlayers.forEach((player, index) => {
        sheet.addRow([index + 1, player.fullName, player.totalStrokes]);
    });
    
    sheet.getColumn('B').width = 30;
};

// ROTA DE EXPORTAÇÃO MODIFICADA
app.get("/api/export/scorecard/tournament/:tournamentId", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();
        const [tournamentInfo]: any[] = await connection.execute(
            "SELECT t.name, t.date, t.courseId FROM tournaments t WHERE id = ?", [tournamentId]
        );
        if (!tournamentInfo.length) return res.status(404).send('Torneio não encontrado.');

        // BUSCAR DADOS DO CAMPO (BURACOS E TEES)
        const [holes]: any[] = await connection.execute(
            `SELECT id, holeNumber, par FROM holes WHERE courseId = ? ORDER BY holeNumber ASC`,
            [tournamentInfo[0].courseId]
        );

        for (const hole of holes) {
            const [tees] = await connection.execute(
                "SELECT color, yardage FROM tees WHERE holeId = ?",
                [hole.id]
            );
            hole.tees = tees;
        }
        const courseData = { holes };

        // O resto da lógica para buscar jogadores e scores permanece igual...
        const [playerData]: any[] = await connection.execute(
            `SELECT p.id as playerId, p.fullName, gp.courseHandicap, tcat.name as categoryName
             FROM players p
             JOIN group_players gp ON p.id = gp.playerId
             JOIN \`groups\` g ON gp.groupId = g.id
             LEFT JOIN tournament_registrations tr ON tr.playerId = p.id AND tr.tournamentId = g.tournamentId
             LEFT JOIN tournament_categories tcat ON tr.categoryId = tcat.id
             WHERE g.tournamentId = ?`, [tournamentId]
        );

        const [allScores]: any[] = await connection.execute(
            `SELECT s.playerId, s.holeNumber, s.strokes FROM scores s JOIN \`groups\` g ON s.groupId = g.id WHERE g.tournamentId = ?`,
            [tournamentId]
        );

        const fullLeaderboard: ScorecardPlayer[] = [];
        const categories: { [key: string]: ScorecardPlayer[] } = {};

        for (const p of playerData) {
            const playerScores = allScores.filter(s => s.playerId === p.playerId);
            const totalStrokes = playerScores.reduce((sum, s) => sum + (s.strokes || 0), 0);
            const netScore = totalStrokes - (p.courseHandicap || 0);

            const calculateTieBreak = (start: number, count: number) => playerScores.filter((s: any) => s.holeNumber >= start && s.holeNumber < start + count).reduce((sum: number, s: any) => sum + (s.strokes || 0), 0);
            const tieBreakScores = { last9: calculateTieBreak(10, 9), last6: calculateTieBreak(13, 6), last3: calculateTieBreak(16, 3), last1: playerScores.find((s: any) => s.holeNumber === 18)?.strokes || 0 };

            const playerEntry: any = { id: p.playerId, fullName: p.fullName, courseHandicap: p.courseHandicap, categoryName: p.categoryName || 'N/A', scores: playerScores, totalStrokes, netScore, tieBreakScores };
            fullLeaderboard.push(playerEntry);

            if (p.categoryName) {
                if (!categories[p.categoryName]) categories[p.categoryName] = [];
                categories[p.categoryName].push(playerEntry);
            }
        }
        
        const tiebreakSort = (a: any, b: any) => {
            if (a.netScore !== b.netScore) return (a.netScore || 0) - (b.netScore || 0);
            if (a.tieBreakScores.last9 !== b.tieBreakScores.last9) { a.tieBreakReason = 'Desempate: Últimos 9'; return a.tieBreakScores.last9 - b.tieBreakScores.last9; }
            if (a.tieBreakScores.last6 !== b.tieBreakScores.last6) { a.tieBreakReason = 'Desempate: Últimos 6'; return a.tieBreakScores.last6 - b.tieBreakScores.last6; }
            if (a.tieBreakScores.last3 !== b.tieBreakScores.last3) { a.tieBreakReason = 'Desempate: Últimos 3'; return a.tieBreakScores.last3 - b.tieBreakScores.last3; }
            if (a.tieBreakScores.last1 !== b.tieBreakScores.last1) { a.tieBreakReason = 'Desempate: Último Buraco'; return a.tieBreakScores.last1 - b.tieBreakScores.last1; }
            return 0;
        };

        fullLeaderboard.sort(tiebreakSort);

        const workbook = new ExcelJS.Workbook();
        
        // Aba Leaderboard Geral (AGORA HORIZONTAL)
        const generalSheet = workbook.addWorksheet('Leaderboard Geral (NET)');
        buildLeaderboardSheet(generalSheet, `${tournamentInfo[0].name} - Leaderboard Geral (NET)`, fullLeaderboard, courseData);

        // Aba Campeões Gross (vertical, como antes)
        const grossSheet = workbook.addWorksheet('Campeões Gross');
        buildGrossChampionsSheet(grossSheet, fullLeaderboard);

        // Abas por Categoria (AGORA HORIZONTAL)
        for (const categoryName in categories) {
            const categorySheet = workbook.addWorksheet(categoryName);
            const categoryPlayers = categories[categoryName].sort(tiebreakSort);
            buildLeaderboardSheet(categorySheet, `${tournamentInfo[0].name} - Categoria ${categoryName}`, categoryPlayers, courseData);
        }

        const fileName = `relatorio_completo_${tournamentInfo[0].name.replace(/\s+/g, '_')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Erro ao exportar relatório de torneio:", error);
        res.status(500).json({ error: "Erro ao exportar." });
    } finally {
        if (connection) connection.release();
    }
});
app.get("/api/courses", async (req: Request, res: Response) => {
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
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar campos." });
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

app.post("/api/tournaments/:tournamentId/register", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    const { playerId, answers } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const [existing]: any = await connection.execute(
            "SELECT id FROM tournament_registrations WHERE playerId = ? AND tournamentId = ?",
            [playerId, tournamentId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: "Você já está inscrito neste torneio." });
        }
        const [result]: any = await connection.execute(
            "INSERT INTO tournament_registrations (playerId, tournamentId, paymentStatus) VALUES (?, ?, 'pending')",
            [playerId, tournamentId]
        );
        const registrationId = result.insertId;
        if (answers && Array.isArray(answers) && answers.length > 0) {
            for (const answer of answers) {
                if (answer.questionId && answer.answerText) {
                    await connection.execute(
                        "INSERT INTO registration_answers (registrationId, questionId, answer) VALUES (?, ?, ?)",
                        [registrationId, answer.questionId, answer.answerText]
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
        res.status(500).json({ error: "Erro interno ao realizar a inscrição." });
    } finally {  
        if (connection) connection.release();  
    }  
});

app.get("/api/tournaments/:tournamentId/export-registrations", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();
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
        LEFT JOIN tournament_questions tq ON ra.questionId = q.id
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
                    player_name: row.player_name,
                    player_email: row.player_email,
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
        const headers = ['Nome', 'Email', 'Status Pagamento', 'Data Inscrição'];
        const questionHeadersSet = new Set<string>();
        registrationsData.forEach((row: any) => {
            if (row.questionText) {
                questionHeadersSet.add(row.questionText);
            }
        });

        const questionHeaders = Array.from(questionHeadersSet);
        headers.push(...questionHeaders);
        worksheet.addRow(headers);

        registrations.forEach((reg: any) => {
            const row = [
                reg.player_name,
                reg.player_email,
                reg.payment_status,
                new Date(reg.registration_date).toLocaleDateString('pt-BR')
            ];
            
            questionHeaders.forEach((question: string) => {
                row.push(reg.questions[question] || "");
            });

            worksheet.addRow(row);
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6E6FA' }
        };

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

app.post("/api/trainings/groups/:groupId/invite", async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const { playerIds } = req.body;
  let connection;

  if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({ error: "É necessário fornecer os IDs dos jogadores a convidar." });
  }

  try {
    connection = await pool.getConnection();
    const values = playerIds.map(playerId => [parseInt(groupId), playerId, 'pending']);
    await connection.query("INSERT IGNORE INTO training_participants (trainingGroupId, playerId, invitationStatus) VALUES ?", [values]);
    res.status(200).json({ message: "Convites enviados com sucesso." });
  } catch (error) {
    res.status(500).json({ error: "Erro interno ao enviar convites."});
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

app.get("/api/users/:userId/invitations", async (req: Request, res: Response) => {
  const { userId } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const [invites] = await connection.execute(
      `SELECT 
        tp.id as invitationId, p.fullName as inviterName, c.name as courseName, t.date
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
    console.error("Erro ao buscar convites:", error);
    res.status(500).json({ error: "Erro ao buscar convites."});
  } finally {
    if (connection) connection.release();
  }
});

app.get("/api/trainings/scorecard/:accessCode", async (req: Request, res: Response) => {
  let connection;
  try {
    const { accessCode } = req.params;
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ error: "Player ID é obrigatório." });

    connection = await pool.getConnection();
    const [groupDetails]: any[] = await connection.execute(
      `SELECT 
        tg.id as groupId, tg.startHole, t.id as trainingId,
        c.name as courseName, c.id as courseId, t.status
      FROM training_groups tg
      JOIN trainings t ON tg.trainingId = t.id
      JOIN courses c ON t.courseId = c.id
      WHERE tg.accessCode = ?`, [accessCode]
    );

    if (groupDetails.length === 0) return res.status(404).json({ error: "Código de acesso de treino inválido." });

    const group = groupDetails[0];
    group.tournamentName = "Sessão de Treino";

    const [players] = await connection.execute(
      `SELECT p.id, p.fullName, tp.teeColor
       FROM training_participants tp JOIN players p ON tp.playerId = p.id
       WHERE tp.trainingGroupId = ? AND tp.invitationStatus = 'accepted'`, [group.groupId]
    );
    group.players = players;

    const [scores] = await connection.execute("SELECT playerId, holeNumber, strokes FROM training_scores WHERE trainingGroupId = ?", [group.groupId]);
    group.scores = scores;

    const [holes]: any[] = await connection.execute("SELECT id, courseId, holeNumber, par, aerialImageUrl FROM holes WHERE courseId = ? ORDER BY holeNumber", [group.courseId]);
    for (const hole of holes) {
      const [tees] = await connection.execute("SELECT * FROM tees WHERE holeId = ?", [hole.id]);
      hole.tees = tees;
    }
    group.holes = holes;
    
    res.json(group);

  } catch (error) {
    console.error("Erro ao buscar dados do scorecard de treino:", error);
    res.status(500).json({ error: "Erro ao buscar dados do scorecard de treino."});
  } finally {
    if (connection) connection.release();
  }
});
  
app.post("/api/training_scores/hole", async (req: Request, res: Response) => {
  const { groupId, holeNumber, scores } = req.body;
  let connection;
  if (!groupId || !holeNumber || !scores || !Array.isArray(scores)) return res.status(400).json({ error: "Dados incompletos ou em formato inválido." });

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const score of scores as { playerId: number, strokes: number }[]) {
      if (score.strokes === null || score.strokes === undefined) continue;
      await connection.execute(
        `INSERT INTO training_scores (trainingGroupId, playerId, holeNumber, strokes) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE strokes = ?`,
        [groupId, score.playerId, holeNumber, score.strokes, score.strokes]
      );
    }
    await connection.commit();
    res.status(200).json({ message: "Pontuações do treino salvas com sucesso."});
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Erro ao salvar pontuações do treino:", error);
    res.status(500).json({ error: "Erro no servidor ao salvar pontuações."});
  } finally {
    if (connection) connection.release();
  }
});

app.post("/api/trainings/finish", async (req: Request, res: Response) => {
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
    } catch (error) {
        console.error("Erro ao finalizar treino:", error);
        res.status(500).json({ success: false, error: "Erro ao finalizar treino." });
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
             JOIN training_participants tp ON tg.id = tp.trainingGroupId AND ts.playerId = ts.playerId
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

app.get("/api/players/search", async (req: Request, res: Response) => {
  const { search, excludeTrainingGroup } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    let query = `
      SELECT p.id, p.fullName, p.email, p.gender FROM players p
      WHERE p.role != 'admin'`;
    const params: any[] = [];

    if (search) {
      query += " AND p.fullName LIKE ?";
      params.push(`%${search}%`);
    }

    if (excludeTrainingGroup) {
      query += ` AND p.id NOT IN (
        SELECT tp.playerId FROM training_participants tp 
        WHERE tp.trainingGroupId = ?)`;
      params.push(excludeTrainingGroup);
    }

    query += " ORDER BY p.fullName ASC LIMIT 20";
    const [players] = await connection.execute(query, params);
    res.json(players);
  } catch (error) {
    console.error("Erro ao buscar jogadores:", error);
    res.status(500).json({ error: "Erro ao buscar jogadores"});
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
            "UPDATE tournaments SET status = 'completed', finishedAt = NOW() WHERE id = ?",
            [id]
        );
        res.status(200).json({ success: true, message: "Torneio finalizado e movido para o histórico!" });
    } catch (error) {
        console.error("Erro ao finalizar torneio:", error);
        res.status(500).json({ success: false, error: "Erro ao finalizar torneio." });
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
        const { fullName, email, password, gender, club } = req.body;
        if (!fullName || !email || !password || !gender) {
            return res.status(400).json({ error: "Campos essenciais em falta." });
        }
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const modality = 'Golf'; // Modalidade fixada

        connection = await pool.getConnection();
        const query = `INSERT INTO players (fullName, email, password, gender, modality, club) VALUES (?, ?, ?, ?, ?, ?)`;
        const [result]: any = await connection.execute(query, [
            fullName, email, hashedPassword, gender, modality, club || null,
        ]);
        res.status(201).json({ success: true, id: result.insertId });
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
                `SELECT p.id as playerId, p.fullName, p.gender, gp.isResponsible, gp.teeColor
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
        const { tournamentId, startHole, players, responsiblePlayerId } = req.body;
        const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [groupResult]: any = await connection.execute(
            "INSERT INTO `groups` (tournamentId, startHole, accessCode) VALUES (?, ?, ?)",
            [tournamentId, startHole, accessCode]
        );
        const newGroupId = groupResult.insertId;

        for (const player of players) {
            await connection.execute(
                "INSERT INTO group_players (groupId, playerId, isResponsible, teeColor) VALUES (?, ?, ?, ?)",
                [newGroupId, player.id, player.id === responsiblePlayerId, player.teeColor]
            );
        }
        await connection.commit();
        res.status(201).json({ success: true, message: "Grupo criado com sucesso!", accessCode });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("ERRO DETALHADO AO CRIAR GRUPO:", error);
        res.status(500).json({ success: false, error: "Erro ao criar o grupo no servidor." });
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

app.post("/api/login", async (req: Request, res: Response) => {
    let connection;
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: "Email e senha são obrigatórios." });
        }
        connection = await pool.getConnection();
        const query = "SELECT id, fullName, email, role, gender, password FROM players WHERE email = ?";
        const [rows]: any[] = await connection.execute(query, [email]);
        if (rows.length === 0) {
            return res.status(401).json({ success: false, error: "Email ou senha inválidos." });
        }
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const { password: _, ...userWithoutPassword } = user;
            res.status(200).json({ success: true, user: userWithoutPassword });
        } else {
            res.status(401).json({ success: false, error: "Email ou senha inválidos." });
        }
    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ success: false, error: "Erro interno no servidor." });
    } finally {
        if (connection) connection.release();
    }
});

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
    const { playerId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();

        const [tournaments]: any[] = await connection.execute(
            `SELECT
                t.id,
                t.name,
                t.date,
                t.finishedAt,
                c.name as courseName,
                'tournament' as type
             FROM tournaments t
             JOIN courses c ON t.courseId = c.id
             WHERE
                t.status = 'completed'
                AND EXISTS (
                    SELECT 1
                    FROM \`groups\` g
                    JOIN group_players gp ON g.id = gp.groupId
                    WHERE g.tournamentId = t.id AND gp.playerId = ?
                )`,
            [playerId]
        );

        const [trainings]: any[] = await connection.execute(
            `SELECT
                t.id,
                'Sessão de Treino' as name,
                t.date,
                t.finishedAt,
                c.name as courseName,
                'training' as type,
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
                )`,
            [playerId]
        );

        const history = [...tournaments, ...trainings];
        history.sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime());

        res.json(history);
    } catch (error) {
        console.error("Erro ao buscar histórico unificado:", error);
        res.status(500).json({ error: "Erro ao buscar histórico." });
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
             JOIN group_players gp ON g.id = gp.groupId AND s.playerId = s.playerId
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

// NOVA ROTA: Exportar resultados de grupo específico
app.get("/api/tournaments/export/grupo/:groupId", async (req: Request, res: Response) => {
    const { groupId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [groupInfo]: any[] = await connection.execute(
            `SELECT t.name as tournamentName, c.name as courseName, g.startHole
             FROM \`groups\` g 
             JOIN tournaments t ON g.tournamentId = t.id
             JOIN courses c ON t.courseId = c.id
             WHERE g.id = ?`, [groupId]
        );

        if (groupInfo.length === 0) {
            return res.status(404).send('Grupo não encontrado.');
        }

        const [players]: any[] = await connection.execute(
            `SELECT p.id, p.fullName FROM players p JOIN group_players gp ON p.id = gp.playerId WHERE gp.groupId = ?`,
            [groupId]
        );

        const [tournament]: any[] = await connection.execute('SELECT courseId FROM tournaments WHERE id = (SELECT tournamentId FROM `groups` WHERE id = ?)', [groupId]);
        const courseId = tournament[0].courseId;

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(`Grupo - Buraco ${groupInfo[0].startHole}`);
        
        sheet.mergeCells('A1:D1');
        sheet.getCell('A1').value = `Resultado do Grupo - ${groupInfo[0].tournamentName}`;
        sheet.getCell('A1').font = { size: 16, bold: true };
        sheet.addRow(['Campo', groupInfo[0].courseName]);
        sheet.addRow([]);

        const headers = ['Buraco', 'Par'];
        players.forEach((p: any) => headers.push(p.fullName));
        sheet.addRow(headers).font = { bold: true };

        const [holes]: any[] = await connection.execute(`
            SELECT holeNumber, par FROM holes WHERE courseId = ? ORDER BY holeNumber
        `, [courseId]);

        const totals: Record<string, number> = {};
        players.forEach((p: any) => totals[p.id] = 0);

        for (const hole of holes) {
            const row: (string | number)[] = [hole.holeNumber, hole.par];
            for (const player of players) {
                const [score]: any[] = await connection.execute(
                    `SELECT strokes FROM scores WHERE groupId = ? AND playerId = ? AND holeNumber = ?`,
                    [groupId, player.id, hole.holeNumber]
                );
                const strokes = score[0]?.strokes || 0;
                row.push(strokes);
                totals[player.id] += strokes;
            }
            sheet.addRow(row);
        }

        const totalRow: (string | number)[] = ['Total', ''];
        players.forEach((p: any) => totalRow.push(totals[p.id]));
        sheet.addRow(totalRow).font = { bold: true };
        
        sheet.columns.forEach((column: any) => { column.width = 15; });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=resultado_grupo_${groupId}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Erro ao exportar grupo do torneio:", error);
        res.status(500).json({ error: "Erro ao exportar." });
    } finally {
        if (connection) connection.release();
    }
});

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
        const expires = new Date(Date.now() + 3600000); // 1 hora
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

app.get("/api/tournaments/:tournamentId/registrations-with-answers", async (req: Request, res: Response) => {
    const { tournamentId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [registrations]: any[] = await connection.execute(
            `SELECT r.id, r.paymentStatus, p.fullName, p.email
             FROM tournament_registrations r
             JOIN players p ON r.playerId = p.id
             WHERE r.tournamentId = ?
             ORDER BY p.fullName ASC`,
            [tournamentId]
        );
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

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

app.get('/api/teste-debug', async (req, res) => {
    console.log('✅ TESTE DEBUG - Esta mensagem DEVE aparecer no terminal!');
    res.json({ message: 'Teste OK - Verifique o terminal!' });
});

app.get("/api/debug/tournaments/:tournamentId/registrations", async (req: Request, res: Response) => {
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
            }
        }));
        res.json(formattedRegistrations);
    } catch (error: any) {
        console.error('❌ DEBUG - ERRO COMPLETO:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar inscritos.',
            debug: { message: error.message, sqlMessage: error.sqlMessage, code: error.code }
        });
    } finally {
        if (connection) connection.release();
    }
});
const scorecardStyler = {
    headerFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } } as ExcelJS.Fill,
    headerFont: { color: { argb: 'FF34D399' }, bold: true, size: 12 },
    titleFont: { color: { argb: 'FFFFFFFF' }, bold: true, size: 16 },
    subtitleFont: { color: { argb: 'FFD1D5DB' }, size: 11 },
    parFont: { bold: true, color: { argb: 'FF34D399' } },
    playerFont: { bold: true, color: { argb: 'FFFFFFFF' } },
    totalsFont: { bold: true, color: { argb: 'FF34D399' } },
    borderStyle: { style: 'thin', color: { argb: 'FF4B5563' } } as ExcelJS.Border,
    applyBorders: (cell: ExcelJS.Cell) => {
        cell.border = { top: scorecardStyler.borderStyle, left: scorecardStyler.borderStyle, bottom: scorecardStyler.borderStyle, right: scorecardStyler.borderStyle };
    }
};

const buildHorizontalScorecard = async (sheet: ExcelJS.Worksheet, title: string, subtitle: string, courseData: CourseForScorecard, playersData: ScorecardPlayer[]) => {
    
    sheet.mergeCells('A1:X1');
    sheet.getCell('A1').value = title;
    sheet.getCell('A1').font = scorecardStyler.titleFont;
    sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.mergeCells('A2:X2');
    sheet.getCell('A2').value = subtitle;
    sheet.getCell('A2').font = scorecardStyler.subtitleFont;
    sheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };

    const headers = ['JOGADOR', 'HDC', ...Array.from({ length: 9 }, (_, i) => i + 1), 'OUT', ...Array.from({ length: 9 }, (_, i) => i + 10), 'IN', 'TOTAL', 'NET'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = scorecardStyler.headerFont;
    headerRow.alignment = { horizontal: 'center' };
    headerRow.eachCell(cell => {
        scorecardStyler.applyBorders(cell);
        cell.fill = scorecardStyler.headerFill;
    });

    const teeColors = Array.from(new Set(courseData.holes.flatMap((h: HoleWithTees) => h.tees.map((t: any) => t.color)))).sort();
    const parRowData = ['PAR', null, ...courseData.holes.slice(0, 9).map((h: HoleWithTees) => h.par), 0, ...courseData.holes.slice(9, 18).map((h: HoleWithTees) => h.par), 0, 0, null];
    const parRow = sheet.addRow(parRowData);
    parRow.font = scorecardStyler.parFont;
    parRow.alignment = { horizontal: 'center' };
    parRow.eachCell(cell => scorecardStyler.applyBorders(cell));

    teeColors.forEach(color => {
        const teeRowData = [color, null, ...courseData.holes.map((h: HoleWithTees) => h.tees.find((t: any) => t.color === color)?.yardage || '-')];
        sheet.addRow(teeRowData).alignment = { horizontal: 'center' };
    });

    playersData.forEach((player: ScorecardPlayer) => {
        const scoresInOrder = Array.from({ length: 18 }, (_, i) => {
            const holeNum = i + 1;
            const score = player.scores.find(s => s.holeNumber === holeNum);
            return score && score.strokes ? score.strokes : null;
        });
        const scoreRowData = [
            player.fullName,
            player.courseHandicap ?? null,
            ...scoresInOrder.slice(0, 9),
            null, 
            ...scoresInOrder.slice(9, 18),
            null, 
            null,
            null
        ];
        const scoreRow = sheet.addRow(scoreRowData);
        scoreRow.getCell(1).font = scorecardStyler.playerFont;
        scoreRow.eachCell(cell => scorecardStyler.applyBorders(cell));
    });

    const startDataRow = 4 + teeColors.length;
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber >= startDataRow) { 
            const outCell = row.getCell(12);
            const inCell = row.getCell(22);
            const totalCell = row.getCell(23);
            const netCell = row.getCell(24);

            outCell.value = { formula: `SUM(C${rowNumber}:K${rowNumber})` };
            inCell.value = { formula: `SUM(M${rowNumber}:U${rowNumber})` };
            totalCell.value = { formula: `L${rowNumber}+V${rowNumber}` };
            
            if (row.getCell(2).value) {
                netCell.value = { formula: `W${rowNumber}-B${rowNumber}` };
            }

            outCell.font = inCell.font = totalCell.font = netCell.font = scorecardStyler.totalsFont;
            [outCell, inCell, totalCell, netCell].forEach(cell => scorecardStyler.applyBorders(cell));
        }
    });
    sheet.getColumn(1).width = 30;
    sheet.getColumn(1).alignment = { horizontal: 'left', vertical: 'middle' };
};
// ROTA UNIFICADA CORRIGIDA
app.get("/api/export/scorecard/:type/:groupId", async (req: Request, res: Response) => {
    const { type, groupId } = req.params;
    const { playerId } = req.query;

    if (type !== 'training' && type !== 'tournament') {
        return res.status(400).send('Tipo de exportação inválido. Use "training" ou "tournament".');
    }
    
    let connection;
    try {
        connection = await pool.getConnection();

        const isTournament = type === 'tournament';
        const infoQuery = isTournament
            ? `SELECT t.name as eventName, t.date, c.name as courseName, c.id as courseId FROM \`groups\` g JOIN tournaments t ON g.tournamentId = t.id JOIN courses c ON t.courseId = c.id WHERE g.id = ?`
            : `SELECT 'Sessão de Treino' as eventName, t.date, c.name as courseName, c.id as courseId FROM training_groups tg JOIN trainings t ON tg.trainingId = t.id JOIN courses c ON t.courseId = c.id WHERE tg.id = ?`;

        const [eventInfo]: any[] = await connection.execute(infoQuery, [groupId]);
        if (eventInfo.length === 0) return res.status(404).send('Grupo não encontrado.');

        const { eventName, date, courseName, courseId } = eventInfo[0];
        
        const [holes]: any[] = await connection.execute("SELECT * FROM holes WHERE courseId = ? ORDER BY holeNumber ASC", [courseId]);
        for (const hole of holes) {
            const [tees] = await connection.execute("SELECT * FROM tees WHERE holeId = ?", [hole.id]);
            hole.tees = tees;
        }

        let playersQuery: string;
        let queryParams: (string | number)[];

        if (playerId) {
            if (isTournament) {
                playersQuery = `SELECT p.id, p.fullName, gp.courseHandicap, tcat.name as categoryName FROM players p JOIN group_players gp ON p.id = gp.playerId LEFT JOIN tournament_registrations tr ON tr.playerId = p.id AND tr.tournamentId = (SELECT tournamentId FROM \`groups\` WHERE id = ?) LEFT JOIN tournament_categories tcat ON tr.categoryId = tcat.id WHERE gp.groupId = ? AND p.id = ?`;
                queryParams = [groupId, groupId, playerId as string];
            } else {
                playersQuery = `SELECT p.id, p.fullName, tp.courseHandicap FROM players p JOIN training_participants tp ON p.id = tp.playerId WHERE tp.trainingGroupId = ? AND p.id = ?`;
                queryParams = [groupId, playerId as string];
            }
        } else {
            if (isTournament) {
                playersQuery = `SELECT p.id, p.fullName, gp.courseHandicap, tcat.name as categoryName FROM players p JOIN group_players gp ON p.id = gp.playerId LEFT JOIN tournament_registrations tr ON tr.playerId = p.id AND tr.tournamentId = (SELECT tournamentId FROM \`groups\` WHERE id = ?) LEFT JOIN tournament_categories tcat ON tr.categoryId = tcat.id WHERE gp.groupId = ?`;
                queryParams = [groupId, groupId];
            } else {
                playersQuery = `SELECT p.id, p.fullName, tp.courseHandicap FROM players p JOIN training_participants tp ON p.id = tp.playerId WHERE tp.trainingGroupId = ?`;
                queryParams = [groupId];
            }
        }

        const [players]: any[] = await connection.execute(playersQuery, queryParams);

        for (const player of (players as ScorecardPlayer[])) {
            const scoresQuery = isTournament
                ? `SELECT h.holeNumber, s.strokes FROM holes h LEFT JOIN scores s ON h.holeNumber = s.holeNumber AND s.playerId = ? AND s.groupId = ? WHERE h.courseId = ? ORDER BY h.holeNumber ASC`
                : `SELECT h.holeNumber, s.strokes FROM holes h LEFT JOIN training_scores s ON h.holeNumber = s.holeNumber AND s.playerId = ? AND s.trainingGroupId = ? WHERE h.courseId = ? ORDER BY h.holeNumber ASC`;
            
            const [scores] = await connection.execute(scoresQuery, [player.id, groupId, courseId]);
            player.scores = scores as any;
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Scorecard');
        
        await buildHorizontalScorecard(sheet, eventName, `${courseName} - ${new Date(date).toLocaleDateString('pt-BR')}`, { holes }, players);
        
        if (isTournament && !playerId) {
            // Futuramente, a lógica de categorias e desempate pode ser adicionada aqui
        }

        const fileName = playerId ? `scorecard_individual_${players[0].fullName.replace(/\s+/g, '_')}.xlsx` : `scorecard_${type}_grupo_${groupId}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error(`Erro ao exportar scorecard de ${type}:`, error);
        res.status(500).json({ error: "Erro ao exportar." });
    } finally {
        if (connection) connection.release();
    }
});

app.listen(port, () => {
    console.log(`✅ Servidor backend rodando em http://localhost:${port}`);
});