import pandas as pd
import duckdb
from cardpay_reward_programs.rule import Rule

class DummyRule(Rule):
    """
    This rules rewards acounts with 
    """

    def __init__(self, core_parameters, user_defined_parameters):
        super(DummyRule, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(
        self,
        token,
        base_reward,
        duration  
    ):
        self.token = token 
        self.base_reward = base_reward
        self.duration = duration
        
    def sql(self, table_query): 
        #THIS FUNCTION IS TO COMPLY WITH THE ABSTRACT METHODS OF rule.py BUT IT IS TEMPORAL
        pass

    def sql_2(self, tables_names): 
        
        spend_accumulation_table = self._get_table_query(
            "spend_accumulation", 
            tables_names[0], 
            self.start_block,
            self.end_block
        )

        safe_owner_table = self._get_table_query(
            "safe_owner", 
            tables_names[1],
            self.start_block,
            self.end_block
        )

        #If any of the tables is empty return a none string
        if safe_owner_table == "parquet_scan([])" or spend_accumulation_table == "parquet_scan([])":
            return None
        
     
        return f""" 
            with merchant_safes as (
 	            select merchant_safe, _block_number
	            from {spend_accumulation_table}
	            where _block_number > $1::integer
	            and _block_number < $2::integer
	            and historic_spend_balance_uint64 > 100000
            ),
            final_safes as (
                select merchant_safe,
                max(_block_number)
                from merchant_safes
                group by 1      
            )
            select safe.owner as payee from {safe_owner_table} as safe, 
                final_safes as f_s
                where f_s.merchant_safe = safe.safe;
        """

    def run(self, payment_cycle: int, reward_program_id: str):
        vars = [
            self.start_block,
            self.end_block
        ]

        tables_names = ["spend_accumulation", "safe_owner"]
        df = self.run_query(tables_names, vars)
           
        df["rewardProgramID"] = reward_program_id
        df["paymentCycle"] = payment_cycle
        df["validFrom"] = payment_cycle
        df["validTo"] = payment_cycle + self.duration
        df["token"] = self.token
        df["amount"] = self.base_reward

        return df

    def run_query(self,tables_names, vars):
        query_string = self.sql_2(tables_names)
        if query_string == None:
            df = pd.DataFrame(columns=[])
        else:
            con = duckdb.connect(database=":memory:", read_only=False) 
            con.execute(query_string, vars)
            df = con.fetchdf()
        return df