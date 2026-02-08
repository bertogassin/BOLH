with Ada.Text_IO; use Ada.Text_IO;
with Bolh_Accounting; use Bolh_Accounting;

procedure Bolh_Accounting_Test is
   B : Amount := 1000;
begin
   Put_Line("Initial balance: " & Integer'Image(B));
   Credit(B, 500);
   Put_Line("After credit: " & Integer'Image(B));
   -- Valid debit
   Debit(B, 200);
   Put_Line("After debit: " & Integer'Image(B));
   -- The following would violate precondition; left commented for proofs
   -- Debit(B, 2000);
end Bolh_Accounting_Test;
